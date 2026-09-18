package com.hatsally.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import java.util.Calendar;

/**
 * محرك الجدولة الأصلي ⏰ (AlarmManager)
 * ------------------------------------------------------------------
 * هذا هو القلب الذي يجعل المنبه يرنّ في موعده تماماً:
 *  - setAlarmClock(): أدق واجهة في أندرويد للمنبهات، توقظ الجهاز من
 *    وضع Doze، تُظهر أيقونة المنبه في شريط الحالة، وتسمح ببدء خدمة
 *    أمامية حتى لو التطبيق في الخلفية (استثناء رسمي من قيود أندرويد 12+).
 *  - إعادة الجدولة بعد كل رنين + بعد الإقلاع + بعد تغيير الوقت/المنطقة
 *    الزمنية، فلا يضيع الموعد أبداً.
 *  - لحاق (catch-up) بالموعد الفائت ضمن مهلة مطابقة لمحرك الويب
 *    (lib/schedule.ts) فلو فُتح الهاتف متأخراً يرنّ فوراً.
 *
 * حساب الموعد هنا مطابق 100% لحساب الويب حتى لا يختلف السلوك بين
 * النسخة الأصلية ونسخة المتصفح.
 */
public final class AlarmScheduler {

    public static final String TAG = "HatSallyAlarm";

    /** بث داخلي صريح: حان موعد الرنين */
    public static final String ACTION_FIRE = "com.hatsally.app.action.ALARM_FIRE";
    /** بث داخلي: تأكد من الحارس والإشعار المثبت */
    public static final String ACTION_GUARD = "com.hatsally.app.action.GUARD";

    private static final int REQ_FIRE = 4101;
    private static final int REQ_OPEN = 4102;
    private static final int REQ_TEST = 4104;
    private static final long DAY_MS = 86400000L;

    private AlarmScheduler() {}

    // ------------------------------------------------------------------
    // الحساب الخالص (Pure) - مطابق لـ lib/schedule.ts
    // ------------------------------------------------------------------

    /** إرجاع [ساعة، دقيقة] أو null لو الوقت فاسد */
    public static int[] parseTime(String time) {
        if (time == null) return null;
        String[] parts = time.split(":");
        if (parts.length < 2) return null;
        try {
            int h = Integer.parseInt(parts[0].trim());
            int m = Integer.parseInt(parts[1].trim());
            if (h < 0 || h > 23 || m < 0 || m > 59) return null;
            return new int[] { h, m };
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static long startOfDay(long millis) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(millis);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    /** هل انتهت مدة المنبه المحدودة؟ */
    public static boolean isExpired(AlarmStore.Config cfg, long millis) {
        if (cfg == null) return false;
        if (cfg.durationDays <= 0) return false; // FOREVER = -1
        if (cfg.startMillis <= 0L) return false;
        Calendar end = Calendar.getInstance();
        end.setTimeInMillis(startOfDay(cfg.startMillis));
        end.add(Calendar.DAY_OF_YEAR, cfg.durationDays);
        return startOfDay(millis) >= end.getTimeInMillis();
    }

    /**
     * أقرب رنين قادم بعد fromMillis (بحث 9 أيام للأمام).
     * يُرجع -1 لو لا يوجد رنين مجدول.
     */
    public static long computeNextFire(AlarmStore.Config cfg, long fromMillis) {
        if (cfg == null || !cfg.armed) return -1L;
        int[] hm = parseTime(cfg.time);
        if (hm == null) return -1L;
        if (cfg.days == null || cfg.days.length == 0) return -1L;
        if (isExpired(cfg, fromMillis)) return -1L;

        Calendar base = Calendar.getInstance();
        base.setTimeInMillis(fromMillis);
        for (int offset = 0; offset < 9; offset++) {
            Calendar day = (Calendar) base.clone();
            day.add(Calendar.DAY_OF_YEAR, offset);
            int jsDay = AlarmStore.calendarDayToJs(day.get(Calendar.DAY_OF_WEEK));
            if (!AlarmStore.containsDay(cfg.days, jsDay)) continue;
            day.set(Calendar.HOUR_OF_DAY, hm[0]);
            day.set(Calendar.MINUTE, hm[1]);
            day.set(Calendar.SECOND, 0);
            day.set(Calendar.MILLISECOND, 0);
            long candidate = day.getTimeInMillis();
            if (candidate <= fromMillis) continue;
            if (isExpired(cfg, candidate)) continue;
            // رنّ اليوم بالفعل؟ لا نكرره
            if (cfg.lastFiredKey != null && cfg.lastFiredKey.equals(AlarmStore.dayKey(candidate))) continue;
            return candidate;
        }
        return -1L;
    }

    /**
     * اللحاق بالموعد: لو حان وقت اليوم (أو فات ضمن المهلة) ولم نرنّ بعد
     * يُرجع وقت الموعد المجدول، وإلا -1.
     */
    public static long dueRingMillis(AlarmStore.Config cfg, long nowMillis) {
        if (cfg == null || !cfg.armed) return -1L;
        int[] hm = parseTime(cfg.time);
        if (hm == null) return -1L;
        if (isExpired(cfg, nowMillis)) return -1L;
        String todayKey = AlarmStore.dayKey(nowMillis);
        if (todayKey.equals(cfg.lastFiredKey)) return -1L;

        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(nowMillis);
        int jsDay = AlarmStore.calendarDayToJs(c.get(Calendar.DAY_OF_WEEK));
        if (!AlarmStore.containsDay(cfg.days, jsDay)) return -1L;
        c.set(Calendar.HOUR_OF_DAY, hm[0]);
        c.set(Calendar.MINUTE, hm[1]);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        long scheduled = c.getTimeInMillis();
        if (nowMillis < scheduled) return -1L;

        long lateMinutes = (nowMillis - scheduled) / 60000L;
        int grace = cfg.graceMinutes > 0 ? cfg.graceMinutes : AlarmStore.DEFAULT_GRACE_MINUTES;
        return lateMinutes <= (long) grace ? scheduled : -1L;
    }

    /** الموعد القادم (يقرأ الإعدادات من المخزن) */
    public static long nextFireAt(Context ctx) {
        return computeNextFire(AlarmStore.load(ctx), System.currentTimeMillis());
    }

    // ------------------------------------------------------------------
    // الجدولة الفعلية في النظام
    // ------------------------------------------------------------------

    public static boolean canScheduleExact(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            return am != null && am.canScheduleExactAlarms();
        } catch (Throwable t) {
            return false;
        }
    }

    public static PendingIntent firePendingIntent(Context ctx) {
        Intent i = new Intent(ctx, AlarmReceiver.class);
        i.setAction(ACTION_FIRE);
        i.setPackage(ctx.getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(ctx, REQ_FIRE, i, flags);
    }

    /**
     * PendingIntent خاص بالاختبار الحقيقي: نفس مسار الفجر تماماً لكن
     * برمز طلب مختلف حتى لا يُلغي الموعد الحقيقي ولا يستهلكه.
     */
    public static PendingIntent testPendingIntent(Context ctx) {
        Intent i = new Intent(ctx, AlarmReceiver.class);
        i.setAction(ACTION_FIRE);
        i.setPackage(ctx.getPackageName());
        i.putExtra(AlarmReceiver.EXTRA_TEST, true);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(ctx, REQ_TEST, i, flags);
    }

    /** PendingIntent الذي يُظهر للمستخدم "منبه قادم" ويفتح التطبيق عند الضغط */
    public static PendingIntent openAppPendingIntent(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse("hatsally://alarm?fire=1"));
        i.setPackage(ctx.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        i.putExtra("hatsally_fire", true);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(ctx, REQ_OPEN, i, flags);
    }

    /**
     * جدولة الموعد القادم في النظام.
     * يُرجع وقت الرنين المجدول (epoch millis) أو -1.
     */
    public static long scheduleNext(Context ctx) {
        AlarmStore.Config cfg = AlarmStore.load(ctx);
        if (!cfg.armed) {
            cancel(ctx);
            return -1L;
        }
        long now = System.currentTimeMillis();
        if (isExpired(cfg, now)) {
            Log.i(TAG, "alarm duration expired - disarming");
            AlarmStore.disarm(ctx);
            cancel(ctx);
            return -1L;
        }

        long due = dueRingMillis(cfg, now);
        long next = computeNextFire(cfg, now);
        long target = due > 0L ? now + 1500L : next;
        if (target <= 0L) {
            cancel(ctx);
            return -1L;
        }

        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return -1L;
        PendingIntent pi = firePendingIntent(ctx);

        boolean ok = false;
        if (due <= 0L) {
            // setAlarmClock = أدق وأقوى واجهة: توقظ من Doze وتسمح ببدء خدمة أمامية
            try {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(target, openAppPendingIntent(ctx)), pi);
                ok = true;
            } catch (SecurityException e) {
                Log.w(TAG, "setAlarmClock denied: " + e.getMessage());
            } catch (Throwable t) {
                Log.w(TAG, "setAlarmClock failed: " + t.getMessage());
            }
            if (!ok) {
                try {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, target, pi);
                    ok = true;
                } catch (Throwable t) {
                    Log.w(TAG, "setExactAndAllowWhileIdle failed: " + t.getMessage());
                }
            }
        }
        if (!ok) {
            // آخر حل: منبه غير دقيق لكنه يعمل أثناء Doze (اللحاق الفوري يستخدم هذا)
            try {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, target, pi);
                ok = true;
            } catch (Throwable t) {
                Log.w(TAG, "setAndAllowWhileIdle failed: " + t.getMessage());
            }
        }
        if (!ok) {
            try {
                am.set(AlarmManager.RTC_WAKEUP, target, pi);
                ok = true;
            } catch (Throwable t) {
                Log.e(TAG, "all alarm scheduling failed", t);
            }
        }

        if (ok) {
            AlarmStore.setScheduledAt(ctx, target);
            Log.i(TAG, "alarm scheduled at " + target + (due > 0L ? " (catch-up)" : ""));
            return target;
        }
        return -1L;
    }

    /** إلغاء الموعد المجدول في النظام (الحقيقي + الاختباري) */
    public static void cancel(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                am.cancel(firePendingIntent(ctx));
                am.cancel(testPendingIntent(ctx));
            }
            AlarmStore.setScheduledAt(ctx, 0L);
        } catch (Throwable t) {
            Log.w(TAG, "cancel failed: " + t.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // تشغيل الخدمة الأمامية (الحارس) بأمان
    // ------------------------------------------------------------------

    /**
     * بدء/تحديث خدمة الحارس. تُستدعى من الواجهة (مسموح دائماً)، ومن
     * مستقبل المنبه (مسموح لأن setAlarmClock يعطي استثناءً رسمياً)، ومن
     * مستقبل الإقلاع (محاولة + تجاوز صامت لو منعها النظام).
     */
    public static void startGuardService(Context ctx, String action) {
        Intent i = new Intent(ctx, AlarmGuardService.class);
        if (action != null) i.setAction(action);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(i);
            } else {
                ctx.startService(i);
            }
        } catch (Throwable t) {
            Log.w(TAG, "startForegroundService failed (" + t.getMessage() + ") - trying startService");
            try {
                ctx.startService(i);
            } catch (Throwable ignored) {
                Log.w(TAG, "startService failed too - guard will resume when the app opens");
            }
        }
    }

    /** إيقاف خدمة الحارس */
    public static void stopGuardService(Context ctx) {
        try {
            Intent i = new Intent(ctx, AlarmGuardService.class);
            i.setAction(AlarmGuardService.ACTION_STOP_ALL);
            ctx.startService(i);
        } catch (Throwable t) {
            try {
                ctx.stopService(new Intent(ctx, AlarmGuardService.class));
            } catch (Throwable ignored) {
                // لا شيء
            }
        }
    }

    /** هل التطبيق متجاهل تحسين البطارية؟ */
    public static boolean isIgnoringBatteryOptimizations(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        try {
            android.os.PowerManager pm =
                (android.os.PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
        } catch (Throwable t) {
            return true;
        }
    }

    /** نص جاهز للسجل/الواجهة يوضح حالة الجدولة */
    public static String describeNext(long millis) {
        if (millis <= 0L) return "-";
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(millis);
        return String.format(
            java.util.Locale.US,
            "%04d-%02d-%02d %02d:%02d",
            c.get(Calendar.YEAR),
            c.get(Calendar.MONTH) + 1,
            c.get(Calendar.DAY_OF_MONTH),
            c.get(Calendar.HOUR_OF_DAY),
            c.get(Calendar.MINUTE)
        );
    }
}
