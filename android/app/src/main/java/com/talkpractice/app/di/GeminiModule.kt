package com.talkpractice.app.di

import com.talkpractice.app.core.gemini.live.GeminiLiveClient
import com.talkpractice.app.core.gemini.live.GeminiLiveClientImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.android.components.ViewModelComponent
import dagger.hilt.android.scopes.ViewModelScoped

/**
 * Scoped to the ViewModel, not the app: each conversation needs its own [GeminiLiveClient]
 * instance (fresh WebSocket, fresh mic/playback lifecycle) rather than one shared singleton
 * reused across situations.
 */
@Module
@InstallIn(ViewModelComponent::class)
abstract class GeminiModule {
    @Binds
    @ViewModelScoped
    abstract fun bindGeminiLiveClient(impl: GeminiLiveClientImpl): GeminiLiveClient
}
