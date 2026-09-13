package com.hatsally.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * متلقي منبه الفجر ⏰
 * ---------------------------------------------------------------
 * مسجل في AndroidManifest (وليس في الذاكرة) فينطلق من نظام
 * أندرويد نفسه في الموعد - حتى لو كان التطبيق مغلقاً تماماً
 * أو اقتُلع من الذاكرة أو أُعيد تشغيل الهاتف:
 *
 * 1) ALARM_FIRE  : حلّ الموعد على ساعة الهاتف
 *    → يشغّل خدمة الرنين (إشعار مستمر + شاشة كاملة + صوت)
 *    → ويعيد ضبط مواعيد الأيام القادمة (المنبه أسبوعي دائم).
 * 2) BOOT_COMPLETED : بعد إعادة تشغيل الهاتف يُعاد ضبط كل المواعيد.
 */
public class HatAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (action == null) return;

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            // أعد ضبط المواعيد على ساعة الهاتف بعد الإقلاع
            HatAlarmScheduler.armFromPrefs(context);
            return;
        }

        if (!HatAlarmScheduler.ACTION_FIRE.equals(action)) return;

        // 1) بدء خدمة الرنين على مستوى النظام (لن يتوقف إلا بالتصوير)
        try {
            Intent svc = new Intent(context, HatAlarmService.class);
            svc.putExtra(HatAlarmService.EXTRA_RINGING, true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc);
            } else {
                context.startService(svc);
            }
        } catch (Exception ignored) {}

        // 2) إعادة ضبط المواعيد القادمة (سلسلة يومية لا تنقطع)
        HatAlarmScheduler.armFromPrefs(context);
    }
}
