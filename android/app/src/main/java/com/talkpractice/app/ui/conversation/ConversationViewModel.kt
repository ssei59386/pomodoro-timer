package com.talkpractice.app.ui.conversation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.talkpractice.app.core.gemini.live.GeminiLiveClient
import com.talkpractice.app.core.gemini.live.LiveEvent
import com.talkpractice.app.domain.model.ConversationMetrics
import com.talkpractice.app.domain.model.Situation
import com.talkpractice.app.ui.navigation.Screen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ConversationUiState(
    val situation: Situation,
    /** null = nobody is speaking right now. */
    val currentSpeakerId: String? = null,
    val isConnecting: Boolean = true,
    val errorMessage: String? = null,
)

@HiltViewModel
class ConversationViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val liveClient: GeminiLiveClient,
) : ViewModel() {

    private val situation: Situation = Situation.fromId(
        checkNotNull(savedStateHandle[Screen.Conversation.ARG_SITUATION_ID]),
    )

    private val _uiState = MutableStateFlow(ConversationUiState(situation = situation))
    val uiState: StateFlow<ConversationUiState> = _uiState.asStateFlow()

    // Real-time signals (aizuchi/interruption counts) that only the live event stream can
    // observe. The transcript log itself is fetched after the call ends (PRD step 4), so it
    // isn't accumulated here.
    private var metrics = ConversationMetrics()
    private var conversationStarted = false

    init {
        viewModelScope.launch {
            liveClient.events.collect(::handleLiveEvent)
        }
    }

    /** Called once RECORD_AUDIO is granted (see [ConversationScreen]). Safe to call more than once. */
    fun startConversationIfNeeded() {
        if (conversationStarted) return
        conversationStarted = true
        viewModelScope.launch {
            runCatching { liveClient.connect(situation) }
                .onFailure { e ->
                    _uiState.update { it.copy(isConnecting = false, errorMessage = e.message ?: "接続に失敗しました") }
                }
        }
    }

    fun endConversation() {
        viewModelScope.launch { liveClient.disconnect() }
    }

    override fun onCleared() {
        super.onCleared()
        // viewModelScope is cancelled right around onCleared, so cleanup here needs its own
        // short-lived scope rather than relying on viewModelScope surviving long enough.
        CoroutineScope(Dispatchers.IO).launch { liveClient.disconnect() }
    }

    private fun handleLiveEvent(event: LiveEvent) {
        when (event) {
            is LiveEvent.Connected -> _uiState.update { it.copy(isConnecting = false, errorMessage = null) }
            is LiveEvent.SpeakerChanged -> _uiState.update { it.copy(currentSpeakerId = event.speakerId) }
            is LiveEvent.UserAizuchiDetected -> metrics = metrics.copy(aizuchiCount = metrics.aizuchiCount + 1)
            is LiveEvent.UserInterrupted -> metrics = metrics.copy(userInterruptionCount = metrics.userInterruptionCount + 1)
            is LiveEvent.Error -> _uiState.update { it.copy(isConnecting = false, errorMessage = event.message) }
            is LiveEvent.Disconnected -> Unit
            is LiveEvent.AudioChunk -> Unit // playback is handled inside GeminiLiveClientImpl
            is LiveEvent.UserTranscript, is LiveEvent.ModelTranscript ->
                Unit // TODO(step4): fold into `transcript` for the report call
        }
    }
}
