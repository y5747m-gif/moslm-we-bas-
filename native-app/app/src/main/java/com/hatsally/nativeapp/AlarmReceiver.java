package com.hatsally.nativeapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import java.util.Calendar;

/**
 * متلقي منبهات الفجر ⏰ (عدة منبهات)
 * ---------------------------------------------------------------
 * مسجل في AndroidManifest فينطلق من نظام أندرويد نفسه في الموعد
 * - حتى لو كان التطبيق مغلقاً أو اقتُلع من الذاكرة:
 *
 * 1) ALARM_FIRE (daily/snooze) : حلّ موعد أحد المنبهات على ساعة الهاتف
 *    → خدمة الرنين + شاشة الرنين الكاملة (باسم هذا المنبه)
 *    → إعادة ضبط كل المواعيد (سلاسل يومية لا تنقطع)
 * 2) BOOT_COMPLETED / TIME_CHANGED / TIMEZONE_CHANGED
 *    → إعادة ضبط كل المواعيد (بعد إعادة التشغيل أو تغيير الساعة)
 */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (action == null) return;

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            // إعادة ضبط كل المواعيد على ساعة الهاتف
            AlarmScheduler.armAll(context);
            return;
        }

        if (!AlarmScheduler.ACTION_FIRE.equals(action)) return;

        String reason = intent.getStringExtra(AlarmScheduler.EXTRA_REASON);
        if (reason == null) reason = "daily";
        int alarmId = intent.getIntExtra(AlarmScheduler.EXTRA_ALARM_ID, 0);

        // علّم هذا المنبه رنّ اليوم (مرة واحدة فقط في اليوم)
        try {
            if (alarmId > 0) {
                AlarmPrefs.setLastFired(context, alarmId,
                        AlarmPrefs.todayKey(Calendar.getInstance()));
            }
        } catch (Exception ignored) {}

        // 1) بدء خدمة الرنين على مستوى النظام (إشعار مستمر + صوت)
        try {
            Intent svc = new Intent(context, AlarmService.class);
            svc.putExtra(AlarmService.EXTRA_RINGING, true);
            svc.putExtra(AlarmService.EXTRA_REASON, reason);
            svc.putExtra(AlarmService.EXTRA_ALARM_ID, alarmId);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc);
            } else {
                context.startService(svc);
            }
        } catch (Exception ignored) {}

        // 2) شاشة الرنين الكاملة (تظهر فوق شاشة القفل عبر FSI أيضاً)
        try {
            Intent act = new Intent(context, AlarmActivity.class);
            act.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            act.putExtra(AlarmService.EXTRA_REASON, reason);
            act.putExtra(AlarmService.EXTRA_ALARM_ID, alarmId);
            context.startActivity(act);
        } catch (Exception ignored) {}

        // 3) إعادة ضبط كل المواعيد (سلسلة لا تنقطع لكل منبه)
        AlarmScheduler.armAll(context);
    }
}
