package com.hatsally.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import java.util.Arrays;
import java.util.Calendar;

/**
 * جدولة منبهات دقيقة على ساعة الهاتف 🕰
 * ---------------------------------------------------------------
 * هذه هي القلقة الحقيقية للمنبه: نستخدم AlarmManager بالموعد
 * الدقيق (setExactAndAllowWhileIdle) ومربوط بساعة الجهاز -
 * وليس بعدادات JavaScript التي تموت عند إغلاق الصفحة.
 *
 * - يعمل حتى لو كان التطبيق مغلقاً أو اقتُلع من الذاكرة
 *   (المواعيد محفوظة في نظام أندرويد نفسه).
 * - يُعاد ضبط المواعيد بعد كل رنين وبعد إعادة تشغيل الهاتف
 *   (متلقي BOOT_COMPLETED في HatAlarmReceiver).
 */
public final class HatAlarmScheduler {
    /** الإجراء الذي يُطلقه المنبه الدقيق */
    public static final String ACTION_FIRE = "com.hatsally.app.ALARM_FIRE";

    /** أساس رقم PendingIntent لكل يوم من أيام الأسبوع */
    private static final int REQUEST_BASE = 7100;

    private HatAlarmScheduler() {}

    /** PendingIntent مخصص ليوم محدد (0=الأحد ... 6=السبت) */
    public static PendingIntent fireIntent(Context ctx, int weekday) {
        Intent i = new Intent(ctx, HatAlarmReceiver.class);
        i.setAction(ACTION_FIRE);
        i.putExtra("weekday", weekday);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(ctx, REQUEST_BASE + weekday, i, flags);
    }

    /**
     * جدولة أول ظهور قادم بعد اللحظة الحالية لكل يوم مختار.
     * كل المواعيد تُحسب من ساعة الجهاز (Calendar.getInstance()).
     *
     * @return أوقات الرنين القادمة بالملي ثانية (للعرض في الواجهة) أو null
     */
    public static long[] armAll(Context ctx, int hour, int minute, int[] days) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null || days == null || days.length == 0) return null;
        int uniqueDays[] = uniqueSorted(days);
        long[] next = new long[uniqueDays.length];
        Calendar now = Calendar.getInstance(); // ساعة الهاتف
        for (int i = 0; i < uniqueDays.length; i++) {
            long trigger = nextOccurrence(now, uniqueDays[i], hour, minute);
            next[i] = trigger;
            try {
                // إلغاء أي نسخة سابقة لنفس اليوم ثم جدولة دقيقة تسمح بالنوم الواعي
                am.cancel(fireIntent(ctx, uniqueDays[i]));
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, fireIntent(ctx, uniqueDays[i]));
                } else {
                    am.setExact(AlarmManager.RTC_WAKEUP, trigger, fireIntent(ctx, uniqueDays[i]));
                }
            } catch (Exception e) {
                // فشل التسجيل (مثلاً: إذن المنبه الدقيق مرفوض في أندرويد 12+)
                // → نرجع null ليتولى البديل (LocalNotifications)
                return null;
            }
        }
        return next;
    }

    /** يُلغي كل المواعيد الدورية للمناسبات السبعة */
    public static void cancelAll(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (int d = 0; d < 7; d++) {
            try {
                am.cancel(fireIntent(ctx, d));
            } catch (Exception ignored) {}
        }
    }

    /**
     * إعادة الضبط من الإعدادات المحفوظة - يُستدعى بعد كل رنين
     * وبعد اكتمال الإقلاع حتى لا يضيع المنبه أبداً.
     */
    public static long[] armFromPrefs(Context ctx) {
        if (!HatAlarmConfig.isActive(ctx)) return null;
        String time = HatAlarmConfig.loadTime(ctx);
        int[] days = HatAlarmConfig.loadDays(ctx);
        if (time == null || days == null) return null;
        String[] parts = time.split(":");
        try {
            int h = Integer.parseInt(parts[0]);
            int m = Integer.parseInt(parts[1]);
            return armAll(ctx, h, m, days);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** المواعيد القادمة (قراءة فقط - بدون جدولة) للعرض */
    public static long[] nextFromPrefs(Context ctx) {
        if (!HatAlarmConfig.isActive(ctx)) return null;
        String time = HatAlarmConfig.loadTime(ctx);
        int[] days = HatAlarmConfig.loadDays(ctx);
        if (time == null || days == null) return null;
        String[] parts = time.split(":");
        try {
            int h = Integer.parseInt(parts[0]);
            int m = Integer.parseInt(parts[1]);
        } catch (NumberFormatException e) {
            return null;
        }
        int[] uniqueDays = uniqueSorted(days);
        long[] next = new long[uniqueDays.length];
        Calendar now = Calendar.getInstance();
        for (int i = 0; i < uniqueDays.length; i++) {
            next[i] = nextOccurrence(now, uniqueDays[i], Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
        }
        return next;
    }

    /**
     * حساب أول ظهور قادم: يوم الأسبوع المطلوب + الساعة والدقيقة،
     * مقارنةً بساعة الجهاز. لو حلّ اليوم على هذا الوقت فالموعد بعد أسبوع.
     */
    static long nextOccurrence(Calendar now, int jsDay, int hour, int minute) {
        Calendar c = (Calendar) now.clone();
        c.set(Calendar.HOUR_OF_DAY, hour);
        c.set(Calendar.MINUTE, minute);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        // Calendar.DAY_OF_WEEK: 1=الأحد ... 7=السبت | JS: 0=الأحد ... 6=السبت
        int target = jsDay + 1;
        int delta = (target - c.get(Calendar.DAY_OF_WEEK) + 7) % 7;
        c.add(Calendar.DAY_OF_MONTH, delta);
        if (!c.after(now)) {
            // حلّ اليوم على هذا الوقت تماماً (أو مضى) → الأسبوع القادم
            c.add(Calendar.DAY_OF_MONTH, 7);
        }
        return c.getTimeInMillis();
    }

    private static int[] uniqueSorted(int[] days) {
        int[] copy = days.clone();
        Arrays.sort(copy);
        int n = 0;
        for (int i = 0; i < copy.length; i++) {
            if (i == 0 || copy[i] != copy[i - 1]) {
                copy[n++] = copy[i];
            }
        }
        int[] out = new int[n];
        System.arraycopy(copy, 0, out, 0, n);
        return out;
    }
}
