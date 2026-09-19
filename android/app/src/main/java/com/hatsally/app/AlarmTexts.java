package com.hatsally.app;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * نصوص الإشعارات المثبتة والرنين 📝 (عربي/إنجليزي)
 * ------------------------------------------------------------------
 * كل النصوص التي تظهر في شريط الإشعارات أو تُنطق بصوت الرجل توجد هنا
 * حتى تبقى الخدمة الأصلية مستقلة تماماً عن الـ WebView.
 */
public final class AlarmTexts {

    private AlarmTexts() {}

    public static boolean isAr(String lang) {
        return lang == null || lang.toLowerCase(Locale.US).startsWith("ar");
    }

    private static Locale locale(String lang) {
        return isAr(lang) ? new Locale("ar") : Locale.US;
    }

    // ------------------------------------------------------------------
    // تنسيقات الوقت
    // ------------------------------------------------------------------

    public static String hhmm(long millis) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(millis);
        return String.format(
            Locale.US,
            "%02d:%02d",
            c.get(Calendar.HOUR_OF_DAY),
            c.get(Calendar.MINUTE)
        );
    }

    public static String weekday(long millis, String lang) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("EEEE", locale(lang));
            return f.format(new Date(millis));
        } catch (Throwable t) {
            return "";
        }
    }

    /** "7س 12د" / "7h 12m" */
    public static String countdown(long remainingMillis, String lang) {
        if (remainingMillis < 0) remainingMillis = 0;
        long minutes = remainingMillis / 60000L;
        long h = minutes / 60L;
        long m = minutes % 60L;
        if (isAr(lang)) {
            if (h > 0) return h + "س " + m + "د";
            if (m > 0) return m + " دقيقة";
            return (remainingMillis / 1000L) + " ثانية";
        }
        if (h > 0) return h + "h " + m + "m";
        if (m > 0) return m + " min";
        return (remainingMillis / 1000L) + " sec";
    }

    /** "الأحد 05:00" */
    public static String whenText(long millis, String lang) {
        return weekday(millis, lang) + " " + hhmm(millis);
    }

    // ------------------------------------------------------------------
    // إشعار الحارس المثبت (لا يمكن إزالته)
    // ------------------------------------------------------------------

    public static String guardTitle(AlarmStore.Config cfg) {
        if (isAr(cfg.lang)) return "🕌 حارس منبه هتصلي يعمل";
        return "🕌 HatSally alarm guard is on";
    }

    public static String guardBody(AlarmStore.Config cfg, long nextFireMillis, long nowMillis) {
        if (nextFireMillis <= 0L) {
            return isAr(cfg.lang)
                ? "لا يوجد رنين مجدول - افتح التطبيق واضبط المنبه"
                : "No ring scheduled - open the app and set your alarm";
        }
        String left = countdown(nextFireMillis - nowMillis, cfg.lang);
        if (isAr(cfg.lang)) {
            return "الرنين القادم: " + whenText(nextFireMillis, cfg.lang) + " (بعد " + left + ")";
        }
        return "Next ring: " + whenText(nextFireMillis, cfg.lang) + " (in " + left + ")";
    }

    public static String guardSub(AlarmStore.Config cfg, boolean exact) {
        if (isAr(cfg.lang)) {
            return exact
                ? "إشعار مثبت لا يمكن إزالته • المنبه يرنّ حتى لو أُغلق التطبيق 🔒"
                : "⚠ فعّل إذن «المنبهات والتذكيرات الدقيقة» لضمان الرنين في الموعد";
        }
        return exact
            ? "Pinned notification - the alarm rings even if the app is closed 🔒"
            : "⚠ Allow \"Alarms & reminders\" so the alarm rings exactly on time";
    }

    // ------------------------------------------------------------------
    // إشعار الرنين (ملء الشاشة + لا يُغلق)
    // ------------------------------------------------------------------

    public static String ringTitle(AlarmStore.Config cfg) {
        String name = cfg.name == null || cfg.name.length() == 0 ? "" : cfg.name;
        if (isAr(cfg.lang)) {
            return name.length() == 0 ? "🚨 استيقظ! حان وقت الصلاة" : "🚨 استيقظ يا " + name + "!";
        }
        return name.length() == 0 ? "🚨 Wake up! Prayer time" : "🚨 Wake up " + name + "!";
    }

    public static String ringBody(AlarmStore.Config cfg) {
        if (isAr(cfg.lang)) {
            return "الرنين لن يتوقف إلا بالتصوير: صنبور المياه 🚰 + المصلاة 🕌 + وجهك وعيناك مفتوحتان 👁";
        }
        return "It won't stop until you photograph: the tap 🚰 + the prayer mat 🕌 + your face with open eyes 👁";
    }

    public static String ringingSub(AlarmStore.Config cfg, long startedAt, long nowMillis) {
        String dur = countdown(nowMillis - startedAt, cfg.lang);
        if (isAr(cfg.lang)) return "يرنّ منذ " + dur + " • افتح التطبيق لإتمام التحقق";
        return "Ringing for " + dur + " • Open the app to verify";
    }

    public static String openAppAction(AlarmStore.Config cfg) {
        return isAr(cfg.lang) ? "افتح التطبيق 📲" : "Open app 📲";
    }

    // ------------------------------------------------------------------
    // النطق بصوت الرجل (TTS داخل الخدمة الأصلية)
    // ------------------------------------------------------------------

    public static String ttsWake(AlarmStore.Config cfg) {
        String name = cfg.name == null || cfg.name.length() == 0 ? "" : cfg.name;
        if (isAr(cfg.lang)) {
            if (name.length() == 0) return "استيقظ، حان وقت صلاة الفجر. قم توضأ وصلِّ.";
            return "استيقظ يا " + name + "، حان وقت صلاة الفجر. قم توضأ وصلِّ، لن يتوقف المنبه إلا بالتصوير.";
        }
        if (name.length() == 0) return "Wake up, it is Fajr time. Get up, make wudu and pray.";
        return "Wake up " + name + ", it is Fajr time. Get up, make wudu and pray. The alarm only stops after photos.";
    }

    public static String ttsLocaleTag(AlarmStore.Config cfg) {
        return isAr(cfg.lang) ? "ar-SA" : "en-US";
    }
}
