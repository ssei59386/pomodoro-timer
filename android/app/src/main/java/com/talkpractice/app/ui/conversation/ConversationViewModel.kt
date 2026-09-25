package com.talkpractice.app.ui.conversation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.talkpractice.app.core.ConversationResultHolder
import com.talkpractice.app.core.gemini.live.GeminiLiveClient
import com.talkpractice.app.core.gemini.live.LiveEvent
import com.talkpractice.app.domain.model.ConversationMetrics
import com.talkpractice.app.domain.model.ConversationResult
import com.talkpractice.app.domain.model.Situation
import com.talkpractice.app.domain.model.TranscriptEntry
import com.talkpractice.app.domain.model.USER_SPEAKER_ID
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
    private val resultHolder: ConversationResultHolder,
) : ViewModel() {

    private val situation: Situation = Situation.fromId(
        checkNotNull(savedStateHandle[Screen.Conversation.ARG_SITUATION_ID]),
    )

    private val _uiState = MutableStateFlow(ConversationUiState(situation = situation))
    val uiState: StateFlow<ConversationUiState> = _uiState.asStateFlow()

    private var metrics = ConversationMetrics()
    private var conversationStarted = false

    // Transcript accumulation: transcription arrives as a stream of small chunks, not
    // clean per-turn messages, so each side's chunks are buffered and flushed into a
    // TranscriptEntry at the next turn boundary (speaker change / turn complete).
    private val transcript = mutableListOf<TranscriptEntry>()
    private val userBuffer = StringBuilder()
    private var userEntryStartMillis = 0L
    private val modelBuffer = StringBuilder()
    private var modelBufferSpeakerId: String? = null
    private var modelEntryStartMillis = 0L
    private var pendingInterruption = false

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
        flushUserEntry()
        flushModelEntry()
        // Approximate speaking durations from the flushed entries' timestamps, since nothing
        // else tracks a running "who's been talking how long" tally during the call.
        val userMillis = transcript.filter { it.speakerId == USER_SPEAKER_ID }
            .sumOf { it.endedAtMillis - it.startedAtMillis }
        val aiMillis = transcript.filter { it.speakerId != USER_SPEAKER_ID }
            .sumOf { it.endedAtMillis - it.startedAtMillis }
        val finalMetrics = metrics.copy(userSpeakingMillis = userMillis, aiSpeakingMillis = aiMillis)
        resultHolder.publish(ConversationResult(situation, transcript.toList(), finalMetrics))
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
            is LiveEvent.SpeakerChanged -> {
                _uiState.update { it.copy(currentSpeakerId = event.speakerId) }
                if (event.speakerId == null) flushModelEntry()
            }
            is LiveEvent.UserTranscript -> {
                if (userBuffer.isEmpty()) userEntryStartMillis = System.currentTimeMillis()
                userBuffer.append(event.text)
            }
            is LiveEvent.ModelTranscript -> {
                flushUserEntry()
                if (event.speakerId != modelBufferSpeakerId) {
                    flushModelEntry()
                    modelBufferSpeakerId = event.speakerId
                    modelEntryStartMillis = System.currentTimeMillis()
                }
                modelBuffer.append(event.text)
            }
            is LiveEvent.UserAizuchiDetected -> metrics = metrics.copy(aizuchiCount = metrics.aizuchiCount + 1)
            is LiveEvent.UserInterrupted -> {
                metrics = metrics.copy(userInterruptionCount = metrics.userInterruptionCount + 1)
                pendingInterruption = true
            }
            is LiveEvent.Error -> _uiState.update { it.copy(isConnecting = false, errorMessage = event.message) }
            is LiveEvent.Disconnected -> Unit
            is LiveEvent.AudioChunk -> Unit // playback is handled inside GeminiLiveClientImpl
        }
    }

    private fun flushUserEntry() {
        if (userBuffer.isBlank()) {
            userBuffer.clear()
            return
        }
        transcript += TranscriptEntry(
            speakerId = USER_SPEAKER_ID,
            speakerLabel = "あなた",
            text = userBuffer.toString().trim(),
            startedAtMillis = userEntryStartMillis,
            endedAtMillis = System.currentTimeMillis(),
        )
        userBuffer.clear()
    }

    private fun flushModelEntry() {
        val speakerId = modelBufferSpeakerId
        val wasInterruption = pendingInterruption
        modelBufferSpeakerId = null
        pendingInterruption = false
        if (speakerId == null || modelBuffer.isBlank()) {
            modelBuffer.clear()
            return
        }
        val label = situation.characters.firstOrNull { it.id == speakerId }?.name ?: speakerId
        transcript += TranscriptEntry(
            speakerId = speakerId,
            speakerLabel = label,
            text = modelBuffer.toString().trim(),
            startedAtMillis = modelEntryStartMillis,
            endedAtMillis = System.currentTimeMillis(),
            wasInterruption = wasInterruption,
        )
        modelBuffer.clear()
    }
}
