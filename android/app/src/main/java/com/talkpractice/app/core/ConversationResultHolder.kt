package com.talkpractice.app.core

import com.talkpractice.app.domain.model.ConversationResult
import javax.inject.Inject
import javax.inject.Singleton

/**
 * In-memory-only hand-off from the conversation screen to the report screen (PRD §1: no
 * persistence, no login). A plain nav-graph-scoped ViewModel would work too, but this app's
 * NavHost is flat rather than nested, so a singleton with consume-once semantics is the
 * simpler way to pass the transcript/metrics across that single navigation hop.
 */
@Singleton
class ConversationResultHolder @Inject constructor() {
    private var pending: ConversationResult? = null

    fun publish(result: ConversationResult) {
        pending = result
    }

    /** Reads and clears the pending result, so re-entering the report screen twice doesn't replay stale data. */
    fun consume(): ConversationResult? = pending.also { pending = null }
}
