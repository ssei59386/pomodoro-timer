package com.talkpractice.app.ui.conversation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.talkpractice.app.domain.model.Situation
import com.talkpractice.app.domain.model.USER_SPEAKER_ID
import com.talkpractice.app.ui.navigation.Screen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ConversationUiState(
    val situation: Situation,
    /** null = nobody is speaking right now. */
    val currentSpeakerId: String? = null,
)

@HiltViewModel
class ConversationViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val situation: Situation = Situation.fromId(
        checkNotNull(savedStateHandle[Screen.Conversation.ARG_SITUATION_ID]),
    )

    private val _uiState = MutableStateFlow(ConversationUiState(situation = situation))
    val uiState: StateFlow<ConversationUiState> = _uiState.asStateFlow()

    init {
        runMockSpeakerRotation()
    }

    /**
     * TODO(step3): replace with collection of `GeminiLiveClient.events`, mapping
     * `LiveEvent.SpeakerChanged`/`UserTranscript` to `currentSpeakerId`. This loop only
     * exists so the "光るギミック" is visible in the step 2 UI mockup before the real
     * Live API connection exists.
     */
    private fun runMockSpeakerRotation() {
        val rotation: List<String?> = buildList {
            add(null)
            situation.characters.forEach { character ->
                add(character.id)
                add(null)
            }
            add(USER_SPEAKER_ID)
        }
        viewModelScope.launch {
            var index = 0
            while (isActive) {
                _uiState.update { it.copy(currentSpeakerId = rotation[index]) }
                delay(if (rotation[index] == null) 900L else 1800L)
                index = (index + 1) % rotation.size
            }
        }
    }
}
