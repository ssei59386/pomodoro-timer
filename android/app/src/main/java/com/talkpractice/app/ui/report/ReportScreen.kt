package com.talkpractice.app.ui.report

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.talkpractice.app.domain.model.EvaluationReport
import com.talkpractice.app.domain.model.RadarScores
import com.talkpractice.app.domain.model.RewriteSuggestion
import com.talkpractice.app.ui.theme.TalkPracticeTheme

/** PRD §3③: radar scores, good/bad points, and rewrite suggestions after the call ends. */
@Composable
fun ReportScreen(viewModel: ReportViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    ReportScreenContent(uiState = uiState)
}

@Composable
private fun ReportScreenContent(uiState: ReportUiState) {
    Scaffold(
        topBar = { TopAppBar(title = { Text("会話の振り返り") }) },
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            when (uiState) {
                is ReportUiState.Loading -> LoadingContent()
                is ReportUiState.Error -> ErrorContent(message = uiState.message)
                is ReportUiState.Success -> ReportContent(report = uiState.report)
            }
        }
    }
}

@Composable
private fun LoadingContent() {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator()
        Text(
            text = "会話を振り返ってレポートを作成しています…",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(top = 16.dp),
        )
    }
}

@Composable
private fun ErrorContent(message: String) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = "レポートを表示できませんでした", style = MaterialTheme.typography.titleMedium)
        Text(text = message, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
    }
}

private val axisLabels = listOf("引き出し力", "相槌", "バランス")

@Composable
private fun ReportContent(report: EvaluationReport) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item {
            Column {
                RadarChart(scores = report.scores, modifier = Modifier.fillMaxWidth())
                ScoreLegend(scores = report.scores)
            }
        }
        item { FeedbackSection(title = "良かった点", points = report.goodPoints, accent = MaterialTheme.colorScheme.primaryContainer) }
        item { FeedbackSection(title = "次はこうしてみよう", points = report.badPoints, accent = MaterialTheme.colorScheme.secondaryContainer) }
        if (report.rewriteSuggestions.isNotEmpty()) {
            item { Text(text = "言い換え提案", style = MaterialTheme.typography.titleMedium) }
            items(report.rewriteSuggestions) { suggestion -> RewriteSuggestionCard(suggestion) }
        }
    }
}

@Composable
private fun ScoreLegend(scores: RadarScores) {
    val values = listOf(scores.drawingOutPersonalTopics, scores.aizuchiTiming, scores.conversationBalance)
    Column(modifier = Modifier.padding(top = 8.dp)) {
        axisLabels.forEachIndexed { index, label ->
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary),
                    )
                    Text(text = label, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(start = 8.dp))
                }
                Text(text = "${values[index]} / 100", style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun FeedbackSection(title: String, points: List<String>, accent: Color) {
    Column {
        Text(text = title, style = MaterialTheme.typography.titleMedium)
        Column(modifier = Modifier.padding(top = 8.dp)) {
            points.forEach { point ->
                Card(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    colors = CardDefaults.cardColors(containerColor = accent),
                ) {
                    Text(text = point, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(12.dp))
                }
            }
        }
    }
}

@Composable
private fun RewriteSuggestionCard(suggestion: RewriteSuggestion) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(text = "あなたの発言: 「${suggestion.originalQuote}」", style = MaterialTheme.typography.bodySmall)
            Text(
                text = "言い換え案: 「${suggestion.suggestedRewrite}」",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                text = suggestion.reason,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun ReportScreenPreview() {
    TalkPracticeTheme {
        ReportScreenContent(
            uiState = ReportUiState.Success(
                EvaluationReport(
                    scores = RadarScores(drawingOutPersonalTopics = 70, aizuchiTiming = 55, conversationBalance = 80),
                    goodPoints = listOf("相手の趣味について深掘りできていました。", "笑顔で話しかけられていました。"),
                    badPoints = listOf("相槌がやや単調でした。", "沈黙が数回長く続きました。"),
                    rewriteSuggestions = listOf(
                        RewriteSuggestion(
                            originalQuote = "そうなんですね",
                            suggestedRewrite = "それってどんなきっかけで始めたんですか？",
                            reason = "相手の話をさらに掘り下げる質問にすると、個人的な話を引き出しやすくなります。",
                        ),
                    ),
                ),
            ),
        )
    }
}
