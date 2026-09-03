package com.talkpractice.app.core.gemini.live

import kotlinx.serialization.Serializable

/**
 * Wire types for the Gemini Live API's `BidiGenerateContent` WebSocket protocol
 * (`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`).
 * Only the subset this app actually sends/reads is modeled; unknown server fields are
 * ignored (see `Json { ignoreUnknownKeys = true }` in [com.talkpractice.app.di.NetworkModule]).
 */

// ---- Client -> server -------------------------------------------------------------

@Serializable
data class SetupClientMessage(val setup: SetupPayload)

@Serializable
data class SetupPayload(
    val model: String,
    val generationConfig: GenerationConfig,
    val systemInstruction: SystemInstruction,
    // Empty objects opt in to transcription with default settings.
    val inputAudioTranscription: AudioTranscriptionConfig = AudioTranscriptionConfig(),
    val outputAudioTranscription: AudioTranscriptionConfig = AudioTranscriptionConfig(),
)

@Serializable
class AudioTranscriptionConfig

@Serializable
data class GenerationConfig(
    val responseModalities: List<String> = listOf("AUDIO"),
    val speechConfig: SpeechConfig? = null,
)

@Serializable
data class SpeechConfig(val voiceConfig: VoiceConfig)

@Serializable
data class VoiceConfig(val prebuiltVoiceConfig: PrebuiltVoiceConfig)

@Serializable
data class PrebuiltVoiceConfig(val voiceName: String)

@Serializable
data class SystemInstruction(val parts: List<TextPart>)

@Serializable
data class TextPart(val text: String)

@Serializable
data class RealtimeInputClientMessage(val realtimeInput: RealtimeInputPayload)

@Serializable
data class RealtimeInputPayload(val audio: AudioBlob)

@Serializable
data class AudioBlob(val mimeType: String, val data: String)

// ---- Server -> client -------------------------------------------------------------

@Serializable
data class LiveServerMessage(
    val setupComplete: SetupComplete? = null,
    val serverContent: ServerContent? = null,
)

@Serializable
class SetupComplete

@Serializable
data class ServerContent(
    val modelTurn: ModelTurn? = null,
    val turnComplete: Boolean? = null,
    val interrupted: Boolean? = null,
    val inputTranscription: TranscriptionText? = null,
    val outputTranscription: TranscriptionText? = null,
)

@Serializable
data class ModelTurn(val parts: List<Part> = emptyList())

@Serializable
data class Part(val inlineData: InlineData? = null, val text: String? = null)

@Serializable
data class InlineData(val mimeType: String? = null, val data: String)

@Serializable
data class TranscriptionText(val text: String = "")
