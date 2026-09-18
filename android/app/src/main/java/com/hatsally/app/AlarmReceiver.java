package com.hatsally.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import android.util.Log;

/**
 * مستقبل المنبه الأصلي ⏰
 * ------------------------------------------------------------------
 * يستقبل:
 *  - ACTION_FIRE: الموعد حان (من AlarmManager) → تشغيل الحارس بالرنين
 *  - ACTION_RESTORE_NOTIFICATION: المستخدم حاول إزالة الإشعار المثبت
 *    (أندرويد 14+ يسمح بالسحب) → إعادته فوراً
 *  - ACTION_STOP_RING: اكتمل التحقق بالتصوير → إيقاف الرنين
 *
 * غير مُصدَّر (exported=false) فلا يستطيع أي تطبيق آخر إرسال هذه البثوث.
 */
public class AlarmReceiver extends BroadcastReceiver {

    public static final String TAG = "HatSallyReceiver";

    public static final String ACTION_RESTORE_NOTIFICATION =
        "com.hatsally.app.action.RESTORE_NOTIFICATION";
    public static final String ACTION_STOP_RING = "com.hatsally.app.action.STOP_RING";

    /** يُحمل في بث الاختبار الحقيقي حتى لا يستهلك موعد اليوم */
    public static final String EXTRA_TEST = "hatsally_test";

    private static PowerManager.WakeLock wakeLock;

    /**
     * قفل مؤقت يضمن إكمال العمل (تشغيل الخدمة) قبل نوم الجهاز.
     * يُحرَّر تلقائياً بعد المهلة - لا نحرره يدوياً حتى تبقى الخدمة
     * قادرة على الإقلاع والصوت حتى لو كان الجهاز على وشك النوم.
     */
    static synchronized void holdWakeLock(Context ctx, long millis) {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
                if (pm == null) return;
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HatSally::ReceiverLock");
                wakeLock.setReferenceCounted(false);
            }
            if (!wakeLock.isHeld()) wakeLock.acquire(millis);
        } catch (Throwable t) {
            Log.w(TAG, "wake lock failed: " + t.getMessage());
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = AlarmScheduler.ACTION_FIRE;
        if (intent != null && intent.getAction() != null) action = intent.getAction();
        Log.i(TAG, "onReceive: " + action);
        holdWakeLock(context, 20000L);
        try {
            if (ACTION_STOP_RING.equals(action)) {
                AlarmGuardService.requestStopRinging(context);
                return;
            }
            if (ACTION_RESTORE_NOTIFICATION.equals(action)) {
                // الإشعار المثبت لا يُزال: أعده عبر الحارس
                AlarmScheduler.startGuardService(context, AlarmGuardService.ACTION_REPOST);
                return;
            }
            if (!AlarmScheduler.ACTION_FIRE.equals(action)) return;

            boolean isTest = intent != null && intent.getBooleanExtra(EXTRA_TEST, false);

            // الاختبار الحقيقي: يقرع الهاتف بنفس المسار دون استهلاك موعد اليوم
            if (isTest) {
                Log.i(TAG, "TEST fire - ringing without consuming today's alarm");
                AlarmStore.setRinging(context, true);
                AlarmScheduler.startGuardService(context, AlarmGuardService.ACTION_RING_FORCE);
                return;
            }

            AlarmStore.Config cfg = AlarmStore.load(context);
            if (!cfg.armed) {
                Log.i(TAG, "fire ignored - alarm is not armed");
                AlarmScheduler.cancel(context);
                return;
            }

            // علّم اليوم + حالة الرنين قبل أي شيء حتى لا يتكرر الرنين
            AlarmStore.markFiredNow(context);
            AlarmStore.setRinging(context, true);

            // الحارس يتكفل بالصوت والاهتزاز والنداء وإشعار ملء الشاشة
            AlarmScheduler.startGuardService(context, AlarmGuardService.ACTION_RING);
            // وجدولة الموعد القادم مباشرة (غداً أو اليوم المختار التالي)
            long next = AlarmScheduler.scheduleNext(context);
            Log.i(TAG, "alarm fired - next at " + AlarmScheduler.describeNext(next));
        } catch (Throwable t) {
            Log.e(TAG, "onReceive failed", t);
        }
    }
}
