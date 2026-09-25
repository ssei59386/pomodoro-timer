package com.talkpractice.app.ui.navigation

/** Type-safe route definitions for the three PRD screens (§3). */
sealed class Screen(val route: String) {
    data object SituationSelect : Screen("situation_select")

    data object Conversation : Screen("conversation/{situationId}") {
        const val ARG_SITUATION_ID = "situationId"
        fun createRoute(situationId: String) = "conversation/$situationId"
    }

    // Report takes no route argument: the transcript/metrics it needs are handed over
    // in-memory via ConversationResultHolder (no persistence layer per PRD §1) rather
    // than serialized through the route.
    data object Report : Screen("report")
}
