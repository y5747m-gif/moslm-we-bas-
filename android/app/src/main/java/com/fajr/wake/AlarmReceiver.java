package com.fajr.wake;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;

/** يستقبل رنات المنبه: الفجر الرئيسي، الاحتياطي، والغفوة */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent == null ? AlarmTools.ACTION_MAIN : intent.getAction();
        if (action == null) action = AlarmTools.ACTION_MAIN;
        Prefs p = Prefs.get(ctx);
        AlarmTools.ensureChannel(ctx);

        if (AlarmTools.ACTION_MAIN.equals(action)) {
            p.setSnoozeCount(0); // بداية يوم جديد
            p.incWakeTotal();
        }

        AlarmTools.postAlarmNotification(ctx, AlarmTools.ACTION_BACKUP.equals(action));
        vibrateBrief(ctx);

        if (AlarmTools.ACTION_MAIN.equals(action)) {
            // تمرير السلسلة: جدولة فجر الغد
            AlarmTools.scheduleAll(ctx);
        }
        // الاحتياطي والغفوة: لا يعدوان الجدولة (سلسلة الغد مجدولة مسبقًا)
    }

    private void vibrateBrief(Context ctx) {
        try {
            Vibrator v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null) return;
            v.vibrate(VibrationEffect.createWaveform(
                    new long[]{0, 500, 250, 500}, -1));
        } catch (Throwable ignored) {
        }
    }
}
