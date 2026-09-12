package com.fajrwake.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * After a reboot, re-schedule the daily alarm ONLY if the user had enabled it.
 * Never enables anything by itself.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_LOCKED_BOOT_COMPLETED
        ) {
            val app = context.applicationContext
            if (AlarmStore(app).enabled) {
                AlarmScheduler.scheduleDaily(app)
            }
        }
    }
}
