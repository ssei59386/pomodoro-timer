package com.talkpractice.app.domain.model

/** Everything the report call needs, handed from the conversation screen to the report screen. */
data class ConversationResult(
    val situation: Situation,
    val transcript: List<TranscriptEntry>,
    val metrics: ConversationMetrics,
)
