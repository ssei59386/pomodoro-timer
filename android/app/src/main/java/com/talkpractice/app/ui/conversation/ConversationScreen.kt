package com.talkpractice.app.ui.conversation

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.talkpractice.app.domain.model.Situation
import com.talkpractice.app.domain.model.USER_SPEAKER_ID
import com.talkpractice.app.ui.theme.TalkPracticeTheme

/**
 * PRD §3②: the AI cast + the user, with the currently-speaking participant highlighted.
 * [viewModel]'s speaker rotation is a step-2 mock (see [ConversationViewModel]) — the
 * layout and glow mechanic here are what step 3 will drive with real Live API events.
 */
@Composable
fun ConversationScreen(
    onFinishConversation: () -> Unit,
    viewModel: ConversationViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    ConversationScreenContent(
        situation = uiState.situation,
        currentSpeakerId = uiState.currentSpeakerId,
        onFinishConversation = onFinishConversation,
    )
}

@Composable
private fun ConversationScreenContent(
    situation: Situation,
    currentSpeakerId: String?,
    onFinishConversation: () -> Unit,
) {
    val context = LocalContext.current
    var microphoneGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted -> microphoneGranted = granted }

    LaunchedEffect(Unit) {
        if (!microphoneGranted) permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text(situation.title) }) },
        bottomBar = {
            Column(modifier = Modifier.padding(16.dp)) {
                Button(onClick = onFinishConversation, modifier = Modifier.fillMaxWidth()) {
                    Text("会話を終了してレポートを見る")
                }
            }
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (!microphoneGranted) {
                MicPermissionNotice(onRequestAgain = { permissionLauncher.launch(Manifest.permission.RECORD_AUDIO) })
            }

            Text(text = "会話相手", style = MaterialTheme.typography.labelLarge)
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(20.dp),
                contentPadding = PaddingValues(vertical = 8.dp),
            ) {
                items(situation.characters) { character ->
                    SpeakerAvatar(
                        label = character.name,
                        isSpeaking = currentSpeakerId == character.id,
                    )
                }
            }

            Text(text = "あなた", style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                SpeakerAvatar(
                    label = "あなた",
                    isSpeaking = currentSpeakerId == USER_SPEAKER_ID,
                )
            }
        }
    }
}

@Composable
private fun MicPermissionNotice(onRequestAgain: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = "会話にはマイクの使用許可が必要です。",
                style = MaterialTheme.typography.bodyMedium,
            )
            Button(onClick = onRequestAgain, modifier = Modifier.padding(top = 8.dp)) {
                Text("マイクを許可する")
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun ConversationScreenPreview() {
    TalkPracticeTheme {
        ConversationScreenContent(
            situation = Situation.WELCOME_LUNCH,
            currentSpeakerId = Situation.WELCOME_LUNCH.characters.first().id,
            onFinishConversation = {},
        )
    }
}
