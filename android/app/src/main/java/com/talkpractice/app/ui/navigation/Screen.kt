package com.talkpractice.app.ui.navigation

/** Type-safe route definitions for the three PRD screens (§3). */
sealed class Screen(val route: String) {
    data object SituationSelect : Screen("situation_select")

    data object Conversation : Screen("conversation/{situationId}") {
        const val ARG_SITUATION_ID = "situationId"
        fun createRoute(situationId: String) = "conversation/$situationId"
    }

    // Report is navigated to with the in-memory result rather than a route argument
    // (no persistence layer per PRD §1), so it is owned by a shared nav-graph-scoped
    // ViewModel instead of taking IDs through the route — wired up in step 4.
    data object Report : Screen("report")
}
