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

    public enum ScheduleStatus {
        EXACT_SCHEDULED,
        INEXACT_SCHEDULED,
        FAILED,
        NO_PERMISSION,
        EXPIRED,
        NO_VALID_TIME,
        NO_VALID_DAYS
    }

    public static final class ScheduleResult {
        public final ScheduleStatus status;
        public final long scheduledAt;
        public final boolean exact;
        ScheduleResult(ScheduleStatus status, long scheduledAt, boolean exact) {
            this.status = status;
            this.scheduledAt = scheduledAt;
            this.exact = exact;
        }
        public boolean isRegistered() {
            return status == ScheduleStatus.EXACT_SCHEDULED || status == ScheduleStatus.INEXACT_SCHEDULED;
        }
        public boolean isFullySuccessful() { return status == ScheduleStatus.EXACT_SCHEDULED; }
    }

    /** بث داخلي صريح: حان موعد الرنين */
    public static final String ACTION_FIRE = "com.hatsally.app.action.ALARM_FIRE";
    /** بث داخلي: تأكد من الحارس والإشعار المثبت */
    public static final String ACTION_GUARD = "com.hatsally.app.action.GUARD";

    private static final int REQ_FIRE = 4101;
    private static final int REQ_OPEN_RING = 4102;
    private static final int REQ_OPEN_STATUS = 4105;
    private static final int REQ_TEST = 4104;
    private static final long DAY_MS = 86400000L;

    private AlarmScheduler() {}

    // ------------------------------------------------------------------
    // الحساب الخالص (Pure) - مطابق لـ lib/schedule.ts
    // ------------------------------------------------------------------

    /** إرجاع [ساعة، دقيقة] أو null لو الوقت فاسد */
    public static int[] parseTime(String time) {
        if (time == null) return null;
        if (!time.matches("^(?:[01]\\d|2[0-3]):[0-5]\\d$")) return null;
        String[] parts = time.split(":", -1);
        if (parts.length != 2) return null;
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
            String candidateKey = AlarmStore.dayKey(candidate);
            if (candidateKey.equals(cfg.lastFiredKey) || candidateKey.equals(cfg.lastMissedKey)) continue;
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
        if (todayKey.equals(cfg.lastFiredKey) || todayKey.equals(cfg.lastMissedKey)) return -1L;

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
        return lateMinutes <= (long) AlarmConstants.DEFAULT_GRACE_MINUTES ? scheduled : -1L;
    }

    /** هل موعد اليوم تجاوز grace ولم يُعالج؟ */
    public static boolean isMissedToday(AlarmStore.Config cfg, long nowMillis) {
        if (cfg == null || !cfg.armed || isExpired(cfg, nowMillis)) return false;
        int[] hm = parseTime(cfg.time);
        if (hm == null) return false;
        String key = AlarmStore.dayKey(nowMillis);
        if (key.equals(cfg.lastFiredKey) || key.equals(cfg.lastMissedKey)) return false;
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(nowMillis);
        int jsDay = AlarmStore.calendarDayToJs(c.get(Calendar.DAY_OF_WEEK));
        if (!AlarmStore.containsDay(cfg.days, jsDay)) return false;
        c.set(Calendar.HOUR_OF_DAY, hm[0]);
        c.set(Calendar.MINUTE, hm[1]);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return nowMillis - c.getTimeInMillis() > AlarmConstants.DEFAULT_GRACE_MINUTES * 60000L;
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

    /**
     * فتح واجهة الرنين. لا يُستخدم إلا بعد أن يبدأ الرنين فعلاً
     * (إشعار ملء الشاشة/إشعار الرنين)، حتى لا يعتبر الضغط على إشعار
     * الحارس أو أيقونة «المنبه القادم» رنيناً بالخطأ.
     */
    public static PendingIntent openRingingPendingIntent(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse("hatsally://alarm?fire=1"));
        i.setPackage(ctx.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        i.putExtra("hatsally_fire", true);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(ctx, REQ_OPEN_RING, i, flags);
    }

    /** فتح التطبيق لعرض حالة المنبه فقط، من دون إطلاق حدث رنين كاذب. */
    public static PendingIntent openStatusPendingIntent(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse("hatsally://alarm?status=1"));
        i.setPackage(ctx.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(ctx, REQ_OPEN_STATUS, i, flags);
    }

    /** اسم قديم أبقيناه للتوافق الداخلي: المقصود به دائماً واجهة الرنين. */
    public static PendingIntent openAppPendingIntent(Context ctx) {
        return openRingingPendingIntent(ctx);
    }

    /**
     * جدولة الموعد القادم في النظام.
     * يُرجع وقت الرنين المجدول (epoch millis) أو -1.
     */
    public static ScheduleResult scheduleNextResult(Context ctx) {
        AlarmStore.Config cfg = AlarmStore.load(ctx);
        if (!cfg.armed) {
            cancel(ctx);
            return remember(ctx, ScheduleStatus.FAILED, -1L, false);
        }
        if (parseTime(cfg.time) == null) {
            cancel(ctx);
            return remember(ctx, ScheduleStatus.NO_VALID_TIME, -1L, false);
        }
        if (cfg.days == null || cfg.days.length == 0) {
            cancel(ctx);
            return remember(ctx, ScheduleStatus.NO_VALID_DAYS, -1L, false);
        }
        long now = System.currentTimeMillis();
        if (isExpired(cfg, now)) {
            AlarmStore.disarm(ctx);
            cancel(ctx);
            return remember(ctx, ScheduleStatus.EXPIRED, -1L, false);
        }

        if (isMissedToday(cfg, now)) {
            AlarmStore.markMissedNow(ctx);
            cfg = AlarmStore.load(ctx);
        }
        long due = dueRingMillis(cfg, now);
        long next = computeNextFire(cfg, now);
        long target = due > 0L ? now + 1500L : next;
        if (target <= 0L) {
            cancel(ctx);
            return remember(ctx, ScheduleStatus.FAILED, -1L, false);
        }

        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return remember(ctx, ScheduleStatus.FAILED, -1L, false);
        PendingIntent pi = firePendingIntent(ctx);
        boolean exactPermission = canScheduleExact(ctx);

        if (exactPermission) {
            try {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(target, openStatusPendingIntent(ctx)), pi);
                AlarmStore.setScheduledAt(ctx, target);
                return remember(ctx, ScheduleStatus.EXACT_SCHEDULED, target, true);
            } catch (Throwable t) {
                Log.e(TAG, "exact alarm scheduling failed", t);
                return remember(ctx, ScheduleStatus.FAILED, -1L, false);
            }
        }

        // نسجل fallback غير دقيق كي لا يصبح المستخدم بلا أي تنبيه، لكن
        // الحالة INEXACT لا تُعرض أبداً كنجاح كامل وتظل تطلب إذن exact.
        try {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, target, pi);
            AlarmStore.setScheduledAt(ctx, target);
            return remember(ctx, ScheduleStatus.INEXACT_SCHEDULED, target, false);
        } catch (Throwable t) {
            Log.e(TAG, "inexact fallback failed without exact permission", t);
            return remember(ctx, ScheduleStatus.NO_PERMISSION, -1L, false);
        }
    }

    private static ScheduleResult remember(Context ctx, ScheduleStatus status, long at, boolean exact) {
        AlarmStore.setScheduleStatus(ctx, status.name());
        if (at <= 0L) AlarmStore.setScheduledAt(ctx, 0L);
        return new ScheduleResult(status, at, exact);
    }

    /** توافق مع الاستدعاءات القديمة؛ الحالة التفصيلية متاحة عبر scheduleNextResult. */
    public static long scheduleNext(Context ctx) {
        return scheduleNextResult(ctx).scheduledAt;
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
