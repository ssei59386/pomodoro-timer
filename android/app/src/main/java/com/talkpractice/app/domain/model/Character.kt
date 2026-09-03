package com.talkpractice.app.domain.model

/**
 * A single AI persona taking part in the conversation. The Live API session is one
 * shared voice per connection (see ARCHITECTURE.md §5 for the trade-off this implies),
 * so [voiceProfile] currently only drives which avatar styling/tag we render — it does
 * not yet select a distinct TTS voice per character.
 */
data class Character(
    val id: String,
    val name: String,
    val role: String,
    val voiceProfile: VoiceProfile,
)

enum class VoiceProfile {
    CALM_MALE,
    CALM_FEMALE,
    BRIGHT_MALE,
    BRIGHT_FEMALE,
}
