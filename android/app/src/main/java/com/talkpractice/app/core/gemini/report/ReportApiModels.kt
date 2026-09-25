package com.talkpractice.app.core.gemini.report

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/** Wire types for the plain (non-streaming) `models/{model}:generateContent` REST endpoint. */

@Serializable
data class GenerateContentRequest(
    val contents: List<ContentDto>,
    val generationConfig: ReportGenerationConfig,
)

@Serializable
data class ContentDto(
    val role: String? = null,
    val parts: List<TextPartDto> = emptyList(),
)

@Serializable
data class TextPartDto(val text: String)

@Serializable
data class ReportGenerationConfig(
    val responseMimeType: String = "application/json",
    val responseSchema: JsonObject,
)

@Serializable
data class GenerateContentResponse(val candidates: List<CandidateDto> = emptyList())

@Serializable
data class CandidateDto(val content: ContentDto? = null)

// ---- The JSON payload the model itself returns (constrained by responseSchema) ----

@Serializable
data class EvaluationReportDto(
    val scores: RadarScoresDto,
    val goodPoints: List<String> = emptyList(),
    val badPoints: List<String> = emptyList(),
    val rewriteSuggestions: List<RewriteSuggestionDto> = emptyList(),
)

@Serializable
data class RadarScoresDto(
    val drawingOutPersonalTopics: Int,
    val aizuchiTiming: Int,
    val conversationBalance: Int,
)

@Serializable
data class RewriteSuggestionDto(
    val originalQuote: String,
    val suggestedRewrite: String,
    val reason: String,
)
