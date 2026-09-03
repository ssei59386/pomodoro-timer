package com.talkpractice.app.core.gemini.report

import com.talkpractice.app.domain.model.ConversationMetrics
import com.talkpractice.app.domain.model.EvaluationReport
import com.talkpractice.app.domain.model.TranscriptEntry

/**
 * Contract for the one-shot report call (PRD §2, "レポート生成"): a plain REST request
 * to `generateContent` (gemini-1.5-pro) with the full transcript + collected metrics,
 * asking for [EvaluationReport]-shaped JSON back via a response schema.
 *
 * Implemented in step 4 by [com.talkpractice.app.core.gemini.report.GeminiReportClientImpl].
 */
interface GeminiReportClient {
    suspend fun generateReport(
        transcript: List<TranscriptEntry>,
        metrics: ConversationMetrics,
    ): Result<EvaluationReport>
}
