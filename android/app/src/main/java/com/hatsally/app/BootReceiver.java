package com.hatsally.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * مستقبِل الإقلاع وتغيّر الوقت 🔄
 * ------------------------------------------------------------------
 * أندرويد يلغي كل المنبهات المجدولة عند إعادة تشغيل الهاتف أو تغيير
 * الوقت/المنطقة الزمنية، وهذا هو السبب الأشهر لـ«المنبه لم يرنّ».
 * هنا نعيد بناء الجدولة فوراً ونُعيد تشغيل الحارس (الإشعار المثبت).
 *
 * يستقبل أيضاً إشعار تغيّر إذن «المنبهات الدقيقة» (أندرويد 12+)
 * فيعيد الجدولة بدقة كاملة لحظة سماح المستخدم.
 */
public class BootReceiver extends BroadcastReceiver {

    public static final String TAG = "HatSallyBoot";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (action == null) return;
        Log.i(TAG, "onReceive: " + action);
        AlarmReceiver.holdWakeLock(context, 20000L);
        try {
            AlarmStore.Config cfg = AlarmStore.load(context);
            if (!cfg.armed) {
                Log.i(TAG, "nothing to restore - alarm is not armed");
                return;
            }

            long now = System.currentTimeMillis();
            long due = AlarmScheduler.dueRingMillis(cfg, now);
            if (due > 0L) {
                // فات الموعد ضمن المهلة (إعادة تشغيل/تغيير وقت) → اللحاق فوراً
                Log.i(TAG, "catch-up ring after " + action);
                AlarmStore.markFiredNow(context);
                AlarmStore.setRinging(context, true);
                AlarmScheduler.startGuardService(context, AlarmGuardService.ACTION_RING);
            } else {
                AlarmScheduler.startGuardService(context, AlarmGuardService.ACTION_GUARD);
            }

            long next = AlarmScheduler.scheduleNext(context);
            Log.i(TAG, "restored after " + action + " - next ring " + AlarmScheduler.describeNext(next));
        } catch (Throwable t) {
            Log.e(TAG, "restore failed", t);
        }
    }
}
