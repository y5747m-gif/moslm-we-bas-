package com.fajrwake.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

/**
 * Handles the explicit "Snooze 5 minutes" action from the ringing screen
 * or the notification. Stops the current ringing and rings again later.
 */
class SnoozeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val app = context.applicationContext
        val minutes = intent?.getIntExtra(EXTRA_MINUTES, 5) ?: 5
        AlarmForegroundService.stop(app)
        AlarmScheduler.scheduleSnooze(app, minutes)
        Toast.makeText(app, "غفوة $minutes دقائق — سنوقظك مجدداً", Toast.LENGTH_LONG).show()
    }

    companion object {
        const val EXTRA_MINUTES = "extra_minutes"

        fun intent(context: Context, minutes: Int = 5): Intent =
            Intent(context, SnoozeReceiver::class.java).apply {
                putExtra(EXTRA_MINUTES, minutes)
            }
    }
}
