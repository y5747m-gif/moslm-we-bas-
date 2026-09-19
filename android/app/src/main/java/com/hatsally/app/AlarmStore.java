package com.hatsally.app;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.Calendar;

/**
 * مخزن المنبه الأصلي 🗄 (SharedPreferences)
 * ------------------------------------------------------------------
 * لماذا هذا الملف؟
 * إعدادات المنبه كانت تعيش داخل localStorage الخاص بالـ WebView فقط،
 * فإذا أُغلق التطبيق أو قُتل العملية لا يبقى لدى النظام أي شيء يوقظ
 * المستخدم. هنا نحفظ نفس الإعدادات في مكان أصلي (native) يقرأه
 * AlarmManager + الخدمة الأمامية + مستقبل الإقلاع، فيعمل المنبه
 * حتى لو:
 *   - أُغلق التطبيق من التطبيقات الأخيرة
 *   - أُعيد تشغيل الهاتف (BootReceiver)
 *   - تغيّر الوقت/المنطقة الزمنية
 *   - ماتت عملية الـ WebView بالكامل
 */
public final class AlarmStore {

    public static final String PREFS_NAME = "hatsally_alarm_engine";

    /** مدة بلا نهاية */
    public static final int FOREVER = -1;
    /** مهلة اللحاق بالموعد بالدقائق (نفس قيمة lib/schedule.ts في الويب) */
    public static final int DEFAULT_GRACE_MINUTES = 45;

    private static final String K_ARMED = "armed";
    private static final String K_TIME = "time";
    private static final String K_DAYS = "days";
    private static final String K_NAME = "name";
    private static final String K_LANG = "lang";
    private static final String K_START = "startMillis";
    private static final String K_DURATION = "durationDays";
    private static final String K_LAST_FIRED = "lastFiredKey";
    private static final String K_GRACE = "graceMinutes";
    private static final String K_RINGING = "ringing";
    private static final String K_RING_STARTED = "ringStartedAt";
    private static final String K_SCHEDULED_AT = "scheduledAt";

    private AlarmStore() {}

    /** إعدادات المنبه كما يفهمها المحرك الأصلي */
    public static final class Config {
        public boolean armed = false;
        /** "HH:MM" بصيغة 24 ساعة */
        public String time = "05:00";
        /** أيام الأسبوع 0=الأحد ... 6=السبت (نفس ترتيب JavaScript) */
        public int[] days = new int[] { 0, 1, 2, 3, 4, 5, 6 };
        public String name = "";
        public String lang = "ar";
        /** تاريخ بدء المدة المحدودة (0 = غير محدد) */
        public long startMillis = 0L;
        /** عدد الأيام أو FOREVER */
        public int durationDays = FOREVER;
        /** آخر يوم رنّ فيه "yyyy-MM-dd" */
        public String lastFiredKey = null;
        public int graceMinutes = DEFAULT_GRACE_MINUTES;
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static Config load(Context ctx) {
        SharedPreferences p = prefs(ctx);
        Config c = new Config();
        c.armed = p.getBoolean(K_ARMED, false);
        c.time = p.getString(K_TIME, "05:00");
        c.days = parseDays(p.getString(K_DAYS, "0,1,2,3,4,5,6"));
        c.name = p.getString(K_NAME, "");
        c.lang = p.getString(K_LANG, "ar");
        c.startMillis = p.getLong(K_START, 0L);
        c.durationDays = p.getInt(K_DURATION, FOREVER);
        c.lastFiredKey = p.getString(K_LAST_FIRED, null);
        c.graceMinutes = p.getInt(K_GRACE, DEFAULT_GRACE_MINUTES);
        return c;
    }

    /** حفظ الإعدادات كاملة (التسليح) */
    public static void save(Context ctx, Config c) {
        prefs(ctx)
            .edit()
            .putBoolean(K_ARMED, c.armed)
            .putString(K_TIME, c.time == null ? "05:00" : c.time)
            .putString(K_DAYS, joinDays(c.days))
            .putString(K_NAME, c.name == null ? "" : c.name)
            .putString(K_LANG, c.lang == null ? "ar" : c.lang)
            .putLong(K_START, c.startMillis)
            .putInt(K_DURATION, c.durationDays)
            .putString(K_LAST_FIRED, c.lastFiredKey)
            .putInt(K_GRACE, c.graceMinutes <= 0 ? DEFAULT_GRACE_MINUTES : c.graceMinutes)
            .apply();
    }

    /** إلغاء التسليح نهائياً (يبقى الاسم والوقت للراحة) */
    public static void disarm(Context ctx) {
        prefs(ctx)
            .edit()
            .putBoolean(K_ARMED, false)
            .putBoolean(K_RINGING, false)
            .putLong(K_RING_STARTED, 0L)
            .putLong(K_SCHEDULED_AT, 0L)
            .remove(K_LAST_FIRED)
            .apply();
    }

    /** مسح كل شيء */
    public static void clear(Context ctx) {
        prefs(ctx).edit().clear().apply();
    }

    public static boolean isArmed(Context ctx) {
        return prefs(ctx).getBoolean(K_ARMED, false);
    }

    /** علّم أن اليوم رنّ (يمنع التكرار في نفس اليوم) */
    public static void markFired(Context ctx, String dayKey) {
        prefs(ctx).edit().putString(K_LAST_FIRED, dayKey).apply();
    }

    public static void markFiredNow(Context ctx) {
        markFired(ctx, dayKey(System.currentTimeMillis()));
    }

    public static void setRinging(Context ctx, boolean ringing) {
        SharedPreferences.Editor e = prefs(ctx).edit().putBoolean(K_RINGING, ringing);
        if (ringing) {
            long started = prefs(ctx).getLong(K_RING_STARTED, 0L);
            if (started <= 0L) e.putLong(K_RING_STARTED, System.currentTimeMillis());
        } else {
            e.putLong(K_RING_STARTED, 0L);
        }
        e.apply();
    }

    public static boolean isRinging(Context ctx) {
        return prefs(ctx).getBoolean(K_RINGING, false);
    }

    public static long ringStartedAt(Context ctx) {
        return prefs(ctx).getLong(K_RING_STARTED, 0L);
    }

    public static void setScheduledAt(Context ctx, long millis) {
        prefs(ctx).edit().putLong(K_SCHEDULED_AT, millis).apply();
    }

    public static long scheduledAt(Context ctx) {
        return prefs(ctx).getLong(K_SCHEDULED_AT, 0L);
    }

    // ------------------------------------------------------------------
    // أدوات
    // ------------------------------------------------------------------

    /** مفتاح اليوم المحلي "yyyy-MM-dd" - مطابق لـ getTodayKey في lib/schedule.ts */
    public static String dayKey(long millis) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(millis);
        int y = c.get(Calendar.YEAR);
        int m = c.get(Calendar.MONTH) + 1;
        int d = c.get(Calendar.DAY_OF_MONTH);
        StringBuilder sb = new StringBuilder(10);
        sb.append(y).append('-');
        if (m < 10) sb.append('0');
        sb.append(m).append('-');
        if (d < 10) sb.append('0');
        sb.append(d);
        return sb.toString();
    }

    public static int[] parseDays(String csv) {
        int[] all = new int[] { 0, 1, 2, 3, 4, 5, 6 };
        if (csv == null || csv.trim().length() == 0) return all;
        String[] parts = csv.split(",");
        int[] out = new int[parts.length];
        int n = 0;
        for (String part : parts) {
            try {
                int v = Integer.parseInt(part.trim());
                if (v >= 0 && v <= 6) out[n++] = v;
            } catch (NumberFormatException ignored) {
                // تجاهل قيمة فاسدة
            }
        }
        if (n == 0) return all;
        int[] res = new int[n];
        System.arraycopy(out, 0, res, 0, n);
        return res;
    }

    public static String joinDays(int[] days) {
        if (days == null || days.length == 0) return "0,1,2,3,4,5,6";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < days.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(days[i]);
        }
        return sb.toString();
    }

    public static boolean containsDay(int[] days, int jsDay) {
        if (days == null) return false;
        for (int d : days) {
            if (d == jsDay) return true;
        }
        return false;
    }

    /** تحويل Calendar.DAY_OF_WEEK (1=الأحد) إلى يوم JavaScript (0=الأحد) */
    public static int calendarDayToJs(int calendarDayOfWeek) {
        return calendarDayOfWeek - 1;
    }
}
