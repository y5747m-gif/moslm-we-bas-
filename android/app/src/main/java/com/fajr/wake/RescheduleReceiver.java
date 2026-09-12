package com.fajr.wake;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * يعيد جدولة المنبه بعد إعادة التشغيل أو تغيير الوقت/المنطقة الزمنية أو تحديث التطبيق،
 * ويعوّض المستخدم إن فاته المنبه (أوقف الهاتف قبل الفجر مثلًا).
 */
public class RescheduleReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        Prefs p = Prefs.get(ctx);
        if (!p.enabled()) return;
        AlarmTools.scheduleAll(ctx);

        String action = intent == null ? null : intent.getAction();
        boolean boot = Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action);
        if (!boot) return;

        // تعويض: إن كان الفجر قد مضى خلال آخر 40 دقيقة فقط، ننبه الآن
        Calendar now = Calendar.getInstance();
        Calendar fajr = PrayerTimes.fajrOn(now, p.lat(), p.lng(),
                p.zone().getOffset(now.getTimeInMillis()) / 3600000.0, p.angle());
        if (fajr == null) return;
        long delta = now.getTimeInMillis() - fajr.getTimeInMillis();
        if (delta > 60_000L && delta <= 40 * 60_000L) {
            AlarmTools.postAlarmNotification(ctx, true);
        }
    }
}
