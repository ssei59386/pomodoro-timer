package com.talkpractice.app.core.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import javax.inject.Inject
import javax.inject.Singleton

const val PLAYBACK_SAMPLE_RATE_HZ = 24_000

/** Streams the Live API's 24kHz PCM audio replies out through [AudioTrack] in MODE_STREAM. */
@Singleton
class AudioPlaybackStreamer @Inject constructor() {

    private var audioTrack: AudioTrack? = null

    fun start() {
        if (audioTrack != null) return
        val minBufferSize = AudioTrack.getMinBufferSize(
            PLAYBACK_SAMPLE_RATE_HZ,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        audioTrack = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(PLAYBACK_SAMPLE_RATE_HZ)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build(),
            )
            .setBufferSizeInBytes(minBufferSize * 2)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
            .also { it.play() }
    }

    /**
     * Blocking write, so call this off the main thread — fine as-is since the only caller,
     * [com.talkpractice.app.core.gemini.live.GeminiLiveClientImpl], is driven from OkHttp's
     * WebSocket listener callbacks, which never run on the main thread.
     */
    fun enqueue(pcm24: ByteArray) {
        audioTrack?.write(pcm24, 0, pcm24.size)
    }

    /** Drops buffered-but-unplayed audio immediately — used on barge-in (user interrupts the AI). */
    fun flush() {
        audioTrack?.apply {
            pause()
            flush()
            play()
        }
    }

    fun stop() {
        audioTrack?.apply {
            stop()
            release()
        }
        audioTrack = null
    }
}
