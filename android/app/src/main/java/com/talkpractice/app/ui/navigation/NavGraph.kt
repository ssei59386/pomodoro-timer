package com.talkpractice.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.talkpractice.app.ui.conversation.ConversationScreen
import com.talkpractice.app.ui.report.ReportScreen
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
                    // ConversationViewModel.endConversation() (called by ConversationScreen
                    // before this navigates) already published the transcript/metrics to
                    // ConversationResultHolder for ReportViewModel to pick up.
                    navController.navigate(Screen.Report.route) {
                        popUpTo(Screen.SituationSelect.route)
                    }
                },
            )
        }
        composable(Screen.Report.route) {
            ReportScreen()
        }
    }
}
