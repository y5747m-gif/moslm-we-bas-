package com.fajrwake.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

/**
 * Schedules the Fajr alarm using [AlarmManager.setAlarmClock], which is the
 * most reliable exact-timing API: it wakes the device from Doze, shows the
 * system alarm indicator, and does not depend on the exact-alarm permission.
 */
object AlarmScheduler {

    private const val REQ_DAILY = 1001
    private const val REQ_ONESHOT = 1002
    private const val REQ_SNOOZE = 1003

    private fun alarmManager(context: Context): AlarmManager =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private fun receiverIntent(context: Context): Intent =
        Intent(context, AlarmReceiver::class.java)

    private fun receiverPending(context: Context, requestCode: Int): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            requestCode,
            receiverIntent(context),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    private fun showIntent(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java)
        return PendingIntent.getActivity(
            context, 2001, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /** Schedule (or re-schedule) the daily alarm at the user-chosen time. */
    fun scheduleDaily(context: Context) {
        val store = AlarmStore(context)
        if (!store.enabled) return
        val triggerAt = nextTriggerMillis(store.hour, store.minute)
        val info = AlarmManager.AlarmClockInfo(triggerAt, showIntent(context))
        alarmManager(context).setAlarmClock(info, receiverPending(context, REQ_DAILY))
    }

    /** One-shot alarm at an absolute time (used for the in-app test button). */
    fun scheduleOneShot(context: Context, triggerAtMillis: Long) {
        val info = AlarmManager.AlarmClockInfo(triggerAtMillis, showIntent(context))
        alarmManager(context).setAlarmClock(info, receiverPending(context, REQ_ONESHOT))
    }

    /** Honest snooze: ring again after [minutes]. The user chose this explicitly. */
    fun scheduleSnooze(context: Context, minutes: Int = 5) {
        val triggerAt = System.currentTimeMillis() + minutes * 60_000L
        val info = AlarmManager.AlarmClockInfo(triggerAt, showIntent(context))
        alarmManager(context).setAlarmClock(info, receiverPending(context, REQ_SNOOZE))
    }

    fun cancelDaily(context: Context) {
        alarmManager(context).cancel(receiverPending(context, REQ_DAILY))
    }

    fun cancelOneShot(context: Context) {
        alarmManager(context).cancel(receiverPending(context, REQ_ONESHOT))
    }

    fun cancelSnooze(context: Context) {
        alarmManager(context).cancel(receiverPending(context, REQ_SNOOZE))
    }

    fun cancelAll(context: Context) {
        cancelDaily(context)
        cancelOneShot(context)
        cancelSnooze(context)
    }

    /** Next occurrence of hour:minute strictly in the future. */
    fun nextTriggerMillis(hour: Int, minute: Int): Long {
        val now = Calendar.getInstance()
        val target = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (target.timeInMillis <= now.timeInMillis) {
            target.add(Calendar.DAY_OF_YEAR, 1)
        }
        return target.timeInMillis
    }
}
