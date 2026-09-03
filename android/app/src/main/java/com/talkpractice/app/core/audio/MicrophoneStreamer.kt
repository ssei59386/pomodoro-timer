package com.talkpractice.app.core.audio

import android.Manifest
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.annotation.RequiresPermission
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.isActive
import javax.inject.Inject
import javax.inject.Singleton

const val MIC_SAMPLE_RATE_HZ = 16_000
private const val CHUNK_DURATION_MILLIS = 100L
private const val BYTES_PER_SAMPLE = 2

/**
 * Streams raw 16-bit PCM mono mic audio at [MIC_SAMPLE_RATE_HZ] (Live API's required input
 * format) in ~100ms chunks. Cancelling collection of the returned flow (e.g. cancelling the
 * job collecting it) stops recording and releases the [AudioRecord] via the `finally` block —
 * there is no separate stop() to remember to call.
 */
@Singleton
class MicrophoneStreamer @Inject constructor() {

    @RequiresPermission(Manifest.permission.RECORD_AUDIO)
    fun start(): Flow<ByteArray> = flow {
        val chunkSizeBytes = (MIC_SAMPLE_RATE_HZ * CHUNK_DURATION_MILLIS / 1000 * BYTES_PER_SAMPLE).toInt()
        val minBufferSize = AudioRecord.getMinBufferSize(
            MIC_SAMPLE_RATE_HZ,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        val audioRecord = AudioRecord(
            // VOICE_COMMUNICATION enables the device's built-in echo cancellation, which
            // matters here since the mic is live at the same time the AI's reply is playing.
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            MIC_SAMPLE_RATE_HZ,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            maxOf(minBufferSize, chunkSizeBytes * 2),
        )

        if (audioRecord.state != AudioRecord.STATE_INITIALIZED) {
            audioRecord.release()
            error("Failed to initialize AudioRecord")
        }

        try {
            audioRecord.startRecording()
            val buffer = ByteArray(chunkSizeBytes)
            while (currentCoroutineContext().isActive) {
                val readBytes = audioRecord.read(buffer, 0, buffer.size)
                if (readBytes > 0) {
                    emit(buffer.copyOf(readBytes))
                }
            }
        } finally {
            audioRecord.stop()
            audioRecord.release()
        }
    }.flowOn(Dispatchers.IO)
}
