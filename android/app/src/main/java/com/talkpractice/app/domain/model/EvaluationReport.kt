package com.talkpractice.app.domain.model

/**
 * Parsed result of the post-conversation report call (PRD §3③), produced in step 4 by
 * asking gemini-1.5-pro to return this shape as JSON.
 */
data class EvaluationReport(
    val scores: RadarScores,
    val goodPoints: List<String>,
    val badPoints: List<String>,
    val rewriteSuggestions: List<RewriteSuggestion>,
)

/** The three PRD-mandated axes, each 0-100. */
data class RadarScores(
    val drawingOutPersonalTopics: Int,
    val aizuchiTiming: Int,
    val conversationBalance: Int,
)

data class RewriteSuggestion(
    val originalQuote: String,
    val suggestedRewrite: String,
    val reason: String,
)
