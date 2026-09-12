package com.fajrwake.alarm

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Loud, looping alarm sound + vibration pattern.
 * Uses the device's own alarm tone — no downloads, no network, fully offline.
 */
class SoundPlayer(private val context: Context) {

    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var started = false

    fun start() {
        if (started) return
        started = true
        startVibration()
        startSound()
    }

    fun stop() {
        started = false
        try {
            player?.stop()
        } catch (_: Exception) {
        }
        try {
            player?.release()
        } catch (_: Exception) {
        }
        player = null
        try {
            vibrator?.cancel()
        } catch (_: Exception) {
        }
        vibrator = null
    }

    private fun startSound() {
        val uri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ?: return
        try {
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            player = MediaPlayer().apply {
                setDataSource(context, uri)
                setAudioAttributes(attrs)
                isLooping = true
                setVolume(1.0f, 1.0f)
                prepare()
                start()
            }
        } catch (_: Exception) {
            // Fallback: single-shot ringtone, re-triggered by the vibration loop anyway.
            try {
                RingtoneManager.getRingtone(context, uri)?.play()
            } catch (_: Exception) {
            }
        }
    }

    private fun startVibration() {
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            manager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
        val vib = vibrator ?: return
        try {
            // Strong repeating pattern: vibrate-pause-vibrate... until stopped.
            val pattern = longArrayOf(0, 800, 300, 800, 300, 1200, 500)
            vib.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } catch (_: Exception) {
        }
    }
}
