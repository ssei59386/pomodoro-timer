package com.talkpractice.app.ui.situationselect

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.talkpractice.app.domain.model.Character
import com.talkpractice.app.domain.model.Situation
import com.talkpractice.app.ui.theme.TalkPracticeTheme

/** PRD §3①: pick one of the three fixed scenarios and jump straight into the conversation. */
@Composable
fun SituationSelectScreen(onSituationSelected: (Situation) -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(title = { Text("シチュエーションを選ぶ") })
        },
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(Situation.entries) { situation ->
                SituationCard(situation = situation, onClick = { onSituationSelected(situation) })
            }
        }
    }
}

@Composable
private fun SituationCard(situation: Situation, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = situation.title, style = MaterialTheme.typography.titleLarge)
            Text(
                text = situation.description,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                situation.characters.forEach { character -> CharacterBadge(character) }
            }
        }
    }
}

@Composable
private fun CharacterBadge(character: Character) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.secondaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = character.name.take(1), style = MaterialTheme.typography.labelLarge)
        }
        Column(modifier = Modifier.padding(start = 6.dp)) {
            Text(text = character.name, style = MaterialTheme.typography.labelMedium)
            Text(text = character.role, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun SituationSelectScreenPreview() {
    TalkPracticeTheme {
        SituationSelectScreen(onSituationSelected = {})
    }
}
