package com.fajrwake.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fired by AlarmManager at Fajr time. Starts the foreground ringing service
 * and re-schedules tomorrow's alarm (daily mode).
 */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        // Keep the daily alarm going: next occurrence is always in the future.
        AlarmScheduler.scheduleDaily(context.applicationContext)
        AlarmForegroundService.start(context.applicationContext)
    }
}
