package com.talkpractice.app.core.gemini.live

import android.util.Base64
import com.talkpractice.app.BuildConfig
import com.talkpractice.app.core.audio.AudioPlaybackStreamer
import com.talkpractice.app.core.audio.MicrophoneStreamer
import com.talkpractice.app.domain.model.Situation
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import javax.inject.Inject

private const val LIVE_WS_URL =
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"

// "Live" models are a distinct family from the regular gemini-* text models; this one
// supports native audio output. Swap here if Google renames/retires the preview id.
private const val MODEL_NAME = "models/gemini-2.5-flash-native-audio-preview-12-2025"
private const val VOICE_NAME = "Aoede"
private const val SETUP_TIMEOUT_MILLIS = 10_000L

/** Utterances short enough, while the AI is mid-turn, to read as a backchannel rather than a reply. */
private val AIZUCHI_PHRASES = listOf(
    "うん", "うんうん", "はい", "ええ", "そう", "そうですね", "そうなんですね",
    "へえ", "なるほど", "そうそう", "わかります", "たしかに",
)
private const val AIZUCHI_MAX_LENGTH = 8

class GeminiLiveClientImpl @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val json: Json,
    private val microphoneStreamer: MicrophoneStreamer,
    private val audioPlayback: AudioPlaybackStreamer,
) : GeminiLiveClient {

    private val _events = MutableSharedFlow<LiveEvent>(extraBufferCapacity = 64)
    override val events: Flow<LiveEvent> = _events.asSharedFlow()

    private var webSocket: WebSocket? = null
    private var connectionScope: CoroutineScope? = null

    // Server callbacks all land on a single OkHttp reader thread per connection, so plain
    // vars (no locking) are safe here.
    private var characterIdByName: Map<String, String> = emptyMap()
    private var currentSpeakerId: String? = null
    private var isAiSpeaking: Boolean = false

    // The RECORD_AUDIO permission check happens in ConversationScreen before
    // startConversationIfNeeded() (and therefore this) is ever called.
    @Suppress("MissingPermission")
    override suspend fun connect(situation: Situation) {
        check(BuildConfig.GEMINI_API_KEY.isNotBlank()) {
            "GEMINI_API_KEY is not set — copy local.properties.example to local.properties and fill it in."
        }
        characterIdByName = situation.characters.associate { it.name to it.id }
        currentSpeakerId = null
        isAiSpeaking = false

        val setupReady = CompletableDeferred<Unit>()
        val request = Request.Builder().url("$LIVE_WS_URL?key=${BuildConfig.GEMINI_API_KEY}").build()

        webSocket = okHttpClient.newWebSocket(
            request,
            object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    val setupMessage = buildSetupMessage(situation)
                    webSocket.send(json.encodeToString(SetupClientMessage.serializer(), setupMessage))
                }

                override fun onMessage(webSocket: WebSocket, text: String) {
                    handleServerMessage(text, setupReady)
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    _events.tryEmit(LiveEvent.Error(t.message ?: "Live API connection failed", t))
                    if (!setupReady.isCompleted) setupReady.completeExceptionally(t)
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    _events.tryEmit(LiveEvent.Disconnected)
                }
            },
        )

        try {
            withTimeout(SETUP_TIMEOUT_MILLIS) { setupReady.await() }
        } catch (t: Throwable) {
            webSocket?.close(1000, "setup failed")
            webSocket = null
            throw t
        }

        audioPlayback.start()
        _events.tryEmit(LiveEvent.Connected)

        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        connectionScope = scope
        scope.launch {
            microphoneStreamer.start().collect { chunk -> sendAudioChunk(chunk) }
        }
    }

    override fun sendAudioChunk(pcm16: ByteArray) {
        val message = RealtimeInputClientMessage(
            realtimeInput = RealtimeInputPayload(
                audio = AudioBlob(mimeType = "audio/pcm;rate=16000", data = Base64.encodeToString(pcm16, Base64.NO_WRAP)),
            ),
        )
        webSocket?.send(json.encodeToString(RealtimeInputClientMessage.serializer(), message))
    }

    override suspend fun disconnect() {
        connectionScope?.cancel()
        connectionScope = null
        audioPlayback.stop()
        webSocket?.close(1000, "user ended conversation")
        webSocket = null
    }

    private fun buildSetupMessage(situation: Situation): SetupClientMessage {
        val cast = situation.characters.joinToString("\n") { "- ${it.name}（${it.role}）" }
        val exampleName = situation.characters.first().name
        val instruction = buildString {
            appendLine("あなたは日本語の会話練習アプリの中で、複数のAIキャラクターを一人二役ならぬ一人多役で演じ分けます。")
            appendLine("シチュエーション: ${situation.title}。${situation.description}")
            appendLine("登場人物:")
            append(cast)
            appendLine()
            appendLine("ルール:")
            appendLine("- 常に1度に1人のキャラクターとしてのみ発言してください。")
            appendLine("- 発言の冒頭で必ずそのキャラクターの名前をそのまま名乗ってから話してください（例:「${exampleName}、それでさ〜」）。")
            appendLine("- ユーザー（あなた）が話す時間を十分に確保するため、AIだけで長く話し続けず、1回の発言は短く区切ってください。")
            appendLine("- ユーザーの発言には自然に相槌を挟み、個人的な話や気持ちを引き出す質問も交えてください。")
            appendLine("- ユーザーが話している間は割り込まず、聞き役に回ってください。")
        }

        return SetupClientMessage(
            setup = SetupPayload(
                model = MODEL_NAME,
                generationConfig = GenerationConfig(
                    responseModalities = listOf("AUDIO"),
                    speechConfig = SpeechConfig(VoiceConfig(PrebuiltVoiceConfig(VOICE_NAME))),
                ),
                systemInstruction = SystemInstruction(parts = listOf(TextPart(instruction))),
            ),
        )
    }

    private fun handleServerMessage(text: String, setupReady: CompletableDeferred<Unit>) {
        val message = try {
            json.decodeFromString(LiveServerMessage.serializer(), text)
        } catch (t: Throwable) {
            _events.tryEmit(LiveEvent.Error("Live APIサーバーメッセージの解析に失敗しました", t))
            return
        }

        if (message.setupComplete != null) {
            if (!setupReady.isCompleted) setupReady.complete(Unit)
            return
        }

        val content = message.serverContent ?: return

        content.outputTranscription?.text?.takeIf { it.isNotEmpty() }?.let { chunk ->
            updateSpeakerFromTranscript(chunk)
            _events.tryEmit(LiveEvent.ModelTranscript(speakerId = currentSpeakerId ?: "ai", text = chunk, isFinal = false))
        }

        content.inputTranscription?.text?.takeIf { it.isNotEmpty() }?.let { chunk ->
            handleUserTranscript(chunk)
        }

        content.modelTurn?.parts.orEmpty().forEach { part ->
            val inline = part.inlineData ?: return@forEach
            val pcm = Base64.decode(inline.data, Base64.NO_WRAP)
            isAiSpeaking = true
            audioPlayback.enqueue(pcm)
            _events.tryEmit(LiveEvent.AudioChunk(speakerId = currentSpeakerId ?: "ai", pcm24 = pcm))
        }

        if (content.interrupted == true) {
            audioPlayback.flush()
            isAiSpeaking = false
            currentSpeakerId = null
            _events.tryEmit(LiveEvent.UserInterrupted)
            _events.tryEmit(LiveEvent.SpeakerChanged(null))
        }

        if (content.turnComplete == true) {
            isAiSpeaking = false
            currentSpeakerId = null
            _events.tryEmit(LiveEvent.SpeakerChanged(null))
        }
    }

    /** Best-effort: the model is asked (see [buildSetupMessage]) to name itself at the start of each turn. */
    private fun updateSpeakerFromTranscript(chunk: String) {
        val trimmed = chunk.trimStart()
        val matchedId = characterIdByName.entries.firstOrNull { (name, _) -> trimmed.startsWith(name) }?.value
        if (matchedId != null && matchedId != currentSpeakerId) {
            currentSpeakerId = matchedId
            _events.tryEmit(LiveEvent.SpeakerChanged(matchedId))
        }
    }

    /**
     * Heuristic: a short, backchannel-shaped utterance that arrives while the AI is still
     * speaking is treated as an aizuchi rather than a real reply. There's no dedicated Live
     * API signal for this — `serverContent.interrupted` only tells us the AI's turn was cut
     * off, not why — so this is an approximation to satisfy PRD §3③'s "相槌は適切か" axis.
     */
    private fun handleUserTranscript(chunk: String) {
        _events.tryEmit(LiveEvent.UserTranscript(text = chunk, isFinal = false))
        val trimmed = chunk.trim()
        if (isAiSpeaking && trimmed.length <= AIZUCHI_MAX_LENGTH && AIZUCHI_PHRASES.any { trimmed.contains(it) }) {
            _events.tryEmit(LiveEvent.UserAizuchiDetected)
        }
    }
}
