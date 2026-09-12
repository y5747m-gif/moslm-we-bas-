package com.fajrwake.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * Foreground ringing service.
 *
 * - Shows an ONGOING high-priority notification with a full-screen intent, so the
 *   ringing screen appears even over the lock screen (standard alarm behavior).
 * - The notification cannot be swiped away WHILE ringing (like every alarm app),
 *   and disappears the moment the alarm is stopped / snoozed / emergency-stopped.
 * - Failsafe: auto-stops after 15 minutes no matter what.
 * - Broadcasts ACTION_ALARM_STOPPED so the ringing screen closes itself.
 */
class AlarmForegroundService : Service() {

    private var sound: SoundPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private val failsafeStop = Runnable { stopSelf() }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        sound = SoundPlayer(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, buildNotification())

        // Keep CPU awake while ringing (with a hard timeout as a failsafe).
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FajrAlarm::Ringing").apply {
                acquire(FAILSAFE_MILLIS)
            }
        } catch (_: Exception) {
        }

        sound?.start()

        // Failsafe: never ring longer than 15 minutes.
        handler.removeCallbacks(failsafeStop)
        handler.postDelayed(failsafeStop, FAILSAFE_MILLIS)

        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(failsafeStop)
        try {
            sound?.stop()
        } catch (_: Exception) {
        }
        sound = null
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {
        }
        wakeLock = null
        // Tell the ringing screen (if visible) to close itself.
        try {
            sendBroadcast(Intent(ACTION_ALARM_STOPPED).setPackage(packageName))
        } catch (_: Exception) {
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notif_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = getString(R.string.notif_channel_desc)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setBypassDnd(true)
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        // Full-screen ringing screen (opens over the lock screen when ringing).
        val fullScreenIntent = Intent(this, AlarmActivity::class.java)
        val fullScreenPending = PendingIntent.getActivity(
            this, 3001, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Honest snooze action, right inside the notification.
        val snoozePending = PendingIntent.getBroadcast(
            this, 3002, SnoozeReceiver.intent(this, 5),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_alarm)
            .setContentTitle(getString(R.string.notif_title))
            .setContentText(getString(R.string.notif_text))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)      // cannot be swiped away while ringing (alarm standard)
            .setAutoCancel(false)
            .setContentIntent(fullScreenPending)
            .setFullScreenIntent(fullScreenPending, true)
            .addAction(R.drawable.ic_alarm, getString(R.string.action_snooze), snoozePending)
            .build()
    }

    companion object {
        const val ACTION_STOP = "com.fajrwake.alarm.ACTION_STOP"
        const val ACTION_ALARM_STOPPED = "com.fajrwake.alarm.ALARM_STOPPED"
        const val CHANNEL_ID = "fajr_ringing"
        const val NOTIFICATION_ID = 41
        const val FAILSAFE_MILLIS = 15 * 60 * 1000L // 15 minutes hard cap

        fun start(context: Context) {
            val intent = Intent(context, AlarmForegroundService::class.java)
            try {
                context.startForegroundService(intent)
            } catch (_: Exception) {
                try {
                    context.startService(intent)
                } catch (_: Exception) {
                }
            }
        }

        fun stop(context: Context) {
            try {
                context.stopService(Intent(context, AlarmForegroundService::class.java))
            } catch (_: Exception) {
            }
            try {
                context.sendBroadcast(Intent(ACTION_ALARM_STOPPED).setPackage(context.packageName))
            } catch (_: Exception) {
            }
        }
    }
}
