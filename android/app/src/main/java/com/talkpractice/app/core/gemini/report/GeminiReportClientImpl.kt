package com.talkpractice.app.core.gemini.report

import com.talkpractice.app.BuildConfig
import com.talkpractice.app.domain.model.ConversationMetrics
import com.talkpractice.app.domain.model.EvaluationReport
import com.talkpractice.app.domain.model.RadarScores
import com.talkpractice.app.domain.model.RewriteSuggestion
import com.talkpractice.app.domain.model.TranscriptEntry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject

// A stable (non-Live) text model — no native-audio requirement here, just reasoning
// over a transcript, so the regular generateContent endpoint applies.
private const val REPORT_MODEL = "gemini-2.5-pro"
private const val GENERATE_CONTENT_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/$REPORT_MODEL:generateContent"
private val JSON_MEDIA_TYPE = "application/json".toMediaType()

class GeminiReportClientImpl @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val json: Json,
) : GeminiReportClient {

    override suspend fun generateReport(
        transcript: List<TranscriptEntry>,
        metrics: ConversationMetrics,
    ): Result<EvaluationReport> = withContext(Dispatchers.IO) {
        runCatching {
            val requestBody = GenerateContentRequest(
                contents = listOf(ContentDto(role = "user", parts = listOf(TextPartDto(buildPrompt(transcript, metrics))))),
                generationConfig = ReportGenerationConfig(responseSchema = reportJsonSchema()),
            )
            val request = Request.Builder()
                .url("$GENERATE_CONTENT_URL?key=${BuildConfig.GEMINI_API_KEY}")
                .post(
                    json.encodeToString(GenerateContentRequest.serializer(), requestBody)
                        .toRequestBody(JSON_MEDIA_TYPE),
                )
                .build()

            val responseText = okHttpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                check(response.isSuccessful) { "generateContent failed (${response.code}): $body" }
                body
            }

            val parsed = json.decodeFromString(GenerateContentResponse.serializer(), responseText)
            val reportJson = parsed.candidates.firstOrNull()?.content?.parts?.firstOrNull()?.text
                ?: error("Gemini response contained no candidates")
            json.decodeFromString(EvaluationReportDto.serializer(), reportJson).toDomain()
        }
    }

    private fun buildPrompt(transcript: List<TranscriptEntry>, metrics: ConversationMetrics): String = buildString {
        appendLine("あなたは会話コーチです。以下は初対面/複数人での会話練習セッションの記録です。「あなた」というラベルがユーザー本人の発言です。")
        appendLine()
        appendLine("## 会話ログ")
        if (transcript.isEmpty()) {
            appendLine("(発話は記録されませんでした)")
        } else {
            transcript.forEach { entry -> appendLine("${entry.speakerLabel}: ${entry.text}") }
        }
        appendLine()
        appendLine("## リアルタイムで計測された統計")
        appendLine("- ユーザーの発話時間: ${metrics.userSpeakingMillis / 1000}秒")
        appendLine("- AIの発話時間: ${metrics.aiSpeakingMillis / 1000}秒")
        appendLine("- 相槌の回数: ${metrics.aizuchiCount}")
        appendLine("- ユーザーがAIの発言に割り込んだ回数: ${metrics.userInterruptionCount}")
        appendLine()
        appendLine("## 評価してほしい3軸（それぞれ0〜100点の整数）")
        appendLine("1. drawingOutPersonalTopics: 相手の個人的な話や気持ちを引き出せたか")
        appendLine("2. aizuchiTiming: 相槌は適切なタイミングで打てていたか")
        appendLine("3. conversationBalance: 会話全体のバランス（自分ばかり話していないか、沈黙や独占が無いか）")
        appendLine()
        appendLine("良かった点・改善点をそれぞれ2〜4個、具体的に挙げてください。")
        appendLine("さらに、ユーザーの実際の発言を1〜2個引用し「こう聞けばもっと相手の話を引き出せた」という言い換え案を提示してください。")
        appendLine("すべて日本語で、ユーザー本人に向けて優しく前向きなトーンで回答してください。")
    }

    private fun reportJsonSchema(): JsonObject = buildJsonObject {
        put("type", "OBJECT")
        putJsonObject("properties") {
            putJsonObject("scores") {
                put("type", "OBJECT")
                putJsonObject("properties") {
                    putJsonObject("drawingOutPersonalTopics") { put("type", "INTEGER") }
                    putJsonObject("aizuchiTiming") { put("type", "INTEGER") }
                    putJsonObject("conversationBalance") { put("type", "INTEGER") }
                }
                putJsonArray("required") {
                    add("drawingOutPersonalTopics")
                    add("aizuchiTiming")
                    add("conversationBalance")
                }
            }
            putJsonObject("goodPoints") {
                put("type", "ARRAY")
                putJsonObject("items") { put("type", "STRING") }
            }
            putJsonObject("badPoints") {
                put("type", "ARRAY")
                putJsonObject("items") { put("type", "STRING") }
            }
            putJsonObject("rewriteSuggestions") {
                put("type", "ARRAY")
                putJsonObject("items") {
                    put("type", "OBJECT")
                    putJsonObject("properties") {
                        putJsonObject("originalQuote") { put("type", "STRING") }
                        putJsonObject("suggestedRewrite") { put("type", "STRING") }
                        putJsonObject("reason") { put("type", "STRING") }
                    }
                    putJsonArray("required") {
                        add("originalQuote")
                        add("suggestedRewrite")
                        add("reason")
                    }
                }
            }
        }
        putJsonArray("required") {
            add("scores")
            add("goodPoints")
            add("badPoints")
            add("rewriteSuggestions")
        }
    }
}

private fun EvaluationReportDto.toDomain() = EvaluationReport(
    scores = RadarScores(
        drawingOutPersonalTopics = scores.drawingOutPersonalTopics,
        aizuchiTiming = scores.aizuchiTiming,
        conversationBalance = scores.conversationBalance,
    ),
    goodPoints = goodPoints,
    badPoints = badPoints,
    rewriteSuggestions = rewriteSuggestions.map {
        RewriteSuggestion(
            originalQuote = it.originalQuote,
            suggestedRewrite = it.suggestedRewrite,
            reason = it.reason,
        )
    },
)
