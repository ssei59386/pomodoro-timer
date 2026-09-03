package com.talkpractice.app.core.gemini.live

import com.talkpractice.app.domain.model.Situation
import kotlinx.coroutines.flow.Flow

/**
 * Contract for the Gemini Multimodal Live API session (PRD §2, "会話（音声・リアルタイム）").
 * Wraps a single WebSocket connection to `BidiGenerateContent`: mic PCM chunks go out
 * through [sendAudioChunk], everything the model does (audio out, transcripts, turn
 * boundaries, VAD-based interruption/aizuchi signals) comes back through [events].
 *
 * Implemented in step 3 by [com.talkpractice.app.core.gemini.live.GeminiLiveClientImpl]
 * (OkHttp WebSocket + 16kHz PCM in / 24kHz PCM out, per Live API's audio format).
 */
interface GeminiLiveClient {
    val events: Flow<LiveEvent>

    suspend fun connect(situation: Situation)

    /** Raw 16-bit PCM, 16kHz mono, little-endian — one microphone buffer per call. */
    fun sendAudioChunk(pcm16: ByteArray)

    suspend fun disconnect()
}

sealed interface LiveEvent {
    data object Connected : LiveEvent

    /**
     * Streamed model audio to play back, tagged with which character the model says is
     * currently speaking (parsed from the transcript, see ARCHITECTURE.md §5) so the UI
     * can light up the right avatar.
     */
    data class AudioChunk(val speakerId: String, val pcm24: ByteArray) : LiveEvent

    data class SpeakerChanged(val speakerId: String?) : LiveEvent

    data class UserTranscript(val text: String, val isFinal: Boolean) : LiveEvent

    data class ModelTranscript(val speakerId: String, val text: String, val isFinal: Boolean) : LiveEvent

    /** Real-time backchannel ("うん", "へえ") detected by VAD while the model is speaking. */
    data object UserAizuchiDetected : LiveEvent

    data object UserInterrupted : LiveEvent

    data class Error(val message: String, val cause: Throwable? = null) : LiveEvent

    data object Disconnected : LiveEvent
}
