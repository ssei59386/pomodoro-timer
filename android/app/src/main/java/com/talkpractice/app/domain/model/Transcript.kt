package com.talkpractice.app.domain.model

/** One turn in the conversation, kept in memory only for the duration of the session. */
data class TranscriptEntry(
    val speakerId: String,
    val speakerLabel: String,
    val text: String,
    val startedAtMillis: Long,
    val endedAtMillis: Long,
    val wasInterruption: Boolean = false,
)

/** Speaker id used for the human user's own turns in [TranscriptEntry]/[ConversationMetrics]. */
const val USER_SPEAKER_ID = "user"

/**
 * Running tallies collected live during the conversation (step 3), consumed by the
 * report prompt in step 4. Kept separate from the raw transcript because some of this
 * — aizuchi timestamps, silence gaps — is only observable in real time, not by re-reading
 * the transcript after the fact.
 */
data class ConversationMetrics(
    val userSpeakingMillis: Long = 0,
    val aiSpeakingMillis: Long = 0,
    val silenceGapsMillis: List<Long> = emptyList(),
    val aizuchiCount: Int = 0,
    val userInterruptionCount: Int = 0,
)
