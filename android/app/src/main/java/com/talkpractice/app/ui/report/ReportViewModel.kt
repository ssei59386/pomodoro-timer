package com.talkpractice.app.ui.report

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.talkpractice.app.core.ConversationResultHolder
import com.talkpractice.app.core.gemini.report.GeminiReportClient
import com.talkpractice.app.domain.model.EvaluationReport
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface ReportUiState {
    data object Loading : ReportUiState
    data class Success(val report: EvaluationReport) : ReportUiState
    data class Error(val message: String) : ReportUiState
}

@HiltViewModel
class ReportViewModel @Inject constructor(
    private val reportClient: GeminiReportClient,
    resultHolder: ConversationResultHolder,
) : ViewModel() {

    private val _uiState = MutableStateFlow<ReportUiState>(ReportUiState.Loading)
    val uiState: StateFlow<ReportUiState> = _uiState.asStateFlow()

    init {
        val result = resultHolder.consume()
        if (result == null) {
            // Can happen if the report screen is reached without a conversation just having
            // ended (e.g. process death mid-navigation) — there's nothing to regenerate since
            // nothing is persisted (PRD §1).
            _uiState.value = ReportUiState.Error("会話データが見つかりませんでした。もう一度会話をやり直してください。")
        } else {
            viewModelScope.launch {
                reportClient.generateReport(result.transcript, result.metrics)
                    .onSuccess { report -> _uiState.value = ReportUiState.Success(report) }
                    .onFailure { e -> _uiState.value = ReportUiState.Error(e.message ?: "レポートの生成に失敗しました。") }
            }
        }
    }
}
