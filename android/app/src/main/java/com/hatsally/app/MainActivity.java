package com.hatsally.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

/**
 * النشاط الرئيسي 📱
 * ------------------------------------------------------------------
 * بالإضافة إلى تشغيل جسر Capacitor:
 *  - يضمن أن الحارس (الخدمة الأمامية + الإشعار المثبت) حيّ كلما فُتح التطبيق
 *  - يعيد جدولة المنبه الأصلي عند العودة للتطبيق (شفاء ذاتي)
 *  - عندما يفتح المنبه التطبيق (فوق شاشة القفل) يخبر الواجهة فوراً
 *    بحدث hatsallyAlarmFire ليبدأ الرنين والتصعيد والتحقق بالتصوير
 *  - على أندرويد 8 وأقل يفعّل أعلام النافذة لإظهار التطبيق فوق القفل
 */
public class MainActivity extends BridgeActivity {

    private final Handler jsHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmPowerPlugin.class);
        super.onCreate(savedInstanceState);
        applyAlarmWindowFlags();
        notifyWebOfAlarm(getIntent(), 1500L);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        try {
            setIntent(intent);
        } catch (Throwable ignored) {
            // لا شيء
        }
        applyAlarmWindowFlags();
        notifyWebOfAlarm(intent, 300L);
    }

    @Override
    public void onResume() {
        super.onResume();
        // التطبيق في المقدمة → بدء الخدمة الأمامية مسموح دائماً (شفاء ذاتي)
        try {
            if (AlarmStore.isArmed(this)) {
                AlarmScheduler.scheduleNext(this);
                AlarmScheduler.startGuardService(this, AlarmGuardService.ACTION_GUARD);
            }
        } catch (Throwable ignored) {
            // لا شيء
        }
        applyAlarmWindowFlags();
        notifyWebOfAlarm(getIntent(), 600L);
    }

    /** إظهار التطبيق فوق شاشة القفل وإضاءة الشاشة أثناء الرنين (أندرويد 8 وأقل) */
    @SuppressWarnings("deprecation")
    private void applyAlarmWindowFlags() {
        try {
            boolean ringing = AlarmStore.isRinging(this);
            Intent intent = getIntent();
            if (!ringing && intent != null) {
                ringing = intent.getBooleanExtra("hatsally_fire", false);
                Uri data = intent.getData();
                if (!ringing && data != null) ringing = "1".equals(data.getQueryParameter("fire"));
            }
            if (!ringing) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
            }
            getWindow()
                .addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                        | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                        | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                        | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                );
        } catch (Throwable ignored) {
            // لا شيء
        }
    }

    /** إبلاغ الواجهة أن المنبه يرنّ (بداية فورية للرنين والتصعيد) */
    private void notifyWebOfAlarm(final Intent intent, long delayMs) {
        boolean fire = false;
        try {
            if (intent != null) {
                if (intent.getBooleanExtra("hatsally_fire", false)) fire = true;
                Uri data = intent.getData();
                if (data != null && "1".equals(data.getQueryParameter("fire"))) fire = true;
            }
        } catch (Throwable ignored) {
            // لا شيء
        }
        if (!fire) {
            try {
                fire = AlarmStore.isRinging(this);
            } catch (Throwable ignored) {
                // لا شيء
            }
        }
        if (!fire) return;
        jsHandler.postDelayed(
            new Runnable() {
                @Override
                public void run() {
                    try {
                        Bridge b = getBridge();
                        if (b != null) b.triggerWindowJSEvent("hatsallyAlarmFire");
                    } catch (Throwable ignored) {
                        // الواجهة تعتمد أيضاً على الاستطلاع الدوري
                    }
                }
            },
            delayMs
        );
    }
}
