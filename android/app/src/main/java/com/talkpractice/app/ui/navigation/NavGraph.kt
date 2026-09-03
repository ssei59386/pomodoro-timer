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
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

/**
 * Skeleton nav graph for step 1: proves the three-screen architecture wires together.
 * Each destination is a placeholder — real UI lands in step 2 (situation select +
 * conversation), and step 4 (report).
 */
@Composable
fun TalkPracticeNavHost(navController: NavHostController = rememberNavController()) {
    NavHost(navController = navController, startDestination = Screen.SituationSelect.route) {
        composable(Screen.SituationSelect.route) {
            PlaceholderScreen(title = "① シチュエーション選択画面")
        }
        composable(Screen.Conversation.route) {
            PlaceholderScreen(title = "② 会話画面")
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
        Text(text = "Step 1: プロジェクト基盤のみ（UIは次のステップで実装）")
    }
}
