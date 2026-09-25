package com.talkpractice.app.di

import com.talkpractice.app.core.gemini.report.GeminiReportClient
import com.talkpractice.app.core.gemini.report.GeminiReportClientImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Unlike [GeminiModule]'s [GeminiLiveClient][com.talkpractice.app.core.gemini.live.GeminiLiveClient]
 * binding, this one is a plain singleton: a report call is a single stateless REST request,
 * not a per-conversation session, so there's no reason each ViewModel needs its own instance.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class GeminiReportModule {
    @Binds
    @Singleton
    abstract fun bindGeminiReportClient(impl: GeminiReportClientImpl): GeminiReportClient
}
