package com.talkpractice.app.ui.navigation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.talkpractice.app.ui.conversation.ConversationScreen
import com.talkpractice.app.ui.situationselect.SituationSelectScreen

@Composable
fun TalkPracticeNavHost(navController: NavHostController = rememberNavController()) {
    NavHost(navController = navController, startDestination = Screen.SituationSelect.route) {
        composable(Screen.SituationSelect.route) {
            SituationSelectScreen(
                onSituationSelected = { situation ->
                    navController.navigate(Screen.Conversation.createRoute(situation.id))
                },
            )
        }
        composable(
            route = Screen.Conversation.route,
            arguments = listOf(navArgument(Screen.Conversation.ARG_SITUATION_ID) { type = NavType.StringType }),
        ) {
            ConversationScreen(
                onFinishConversation = {
                    // TODO(step4): pass the collected transcript/metrics through to the
                    // report screen instead of just navigating to a placeholder.
                    navController.navigate(Screen.Report.route) {
                        popUpTo(Screen.SituationSelect.route)
                    }
                },
            )
        }
        composable(Screen.Report.route) {
            PlaceholderScreen(title = "③ 採点レポート画面")
        }
    }
}

@Composable
private fun PlaceholderScreen(title: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = title, style = MaterialTheme.typography.headlineSmall)
        Text(text = "Step 4で実装予定")
    }
}
