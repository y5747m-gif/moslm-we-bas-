package com.fajrwake.alarm

import android.content.Context
import android.content.SharedPreferences

/**
 * Local-only storage for the alarm settings.
 * Everything stays on the device (SharedPreferences + app-private files).
 */
class AlarmStore(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    var enabled: Boolean
        get() = prefs.getBoolean(KEY_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

    var hour: Int
        get() = prefs.getInt(KEY_HOUR, 4)
        set(value) = prefs.edit().putInt(KEY_HOUR, value).apply()

    var minute: Int
        get() = prefs.getInt(KEY_MINUTE, 35)
        set(value) = prefs.edit().putInt(KEY_MINUTE, value).apply()

    /** Number of proof photos required to stop the alarm. Fixed at 3. */
    val photosRequired: Int = 3

    /** Snooze duration in minutes. */
    val snoozeMinutes: Int = 5

    fun timeLabel(): String = String.format("%02d:%02d", hour, minute)

    companion object {
        private const val PREFS_NAME = "fajr_alarm_prefs"
        private const val KEY_ENABLED = "enabled"
        private const val KEY_HOUR = "hour"
        private const val KEY_MINUTE = "minute"
    }
}
