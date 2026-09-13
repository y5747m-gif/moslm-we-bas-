package com.hatsally.nativeapp;

import android.app.AlarmClockInfo;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

/**
 * جدولة منبهات الفجر على ساعة الهاتف 🕰 (عدة منبهات)
 * ---------------------------------------------------------------
 * كل منبه له موعد دقيق مستقل داخل نظام أندرويد (AlarmManager):
 * - setAlarmClock: الدرجة نفسها التي يستخدمها تطبيق الساعة
 *   (مستثنى من Doze وتحسينات البطارية)
 * - بديل: setExactAndAllowWhileIdle ثم setExact
 * - يُعاد ضبط كل المواعيد بعد كل رنين، بعد الإقلاع، وعند تغيير
 *   الساعة/المنطقة (في AlarmReceiver) - فلا يضيع أي منبه أبداً
 */
public final class AlarmScheduler {
    public static final String ACTION_FIRE = "com.hatsally.nativeapp.ALARM_FIRE";
    public static final String EXTRA_REASON = "reason"; // "daily" | "snooze"
    public static final String EXTRA_ALARM_ID = "alarm_id";

    private AlarmScheduler() {}

    private static int immutableFlags() {
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) f |= PendingIntent.FLAG_IMMUTABLE;
        return f;
    }

    /** نية إطلاق رنين منبه محدد (معرّفه = كود الـ PendingIntent) */
    public static PendingIntent fireIntent(Context ctx, int alarmId, String reason) {
        Intent i = new Intent(ctx, AlarmReceiver.class);
        i.setAction(ACTION_FIRE);
        i.putExtra(EXTRA_REASON, reason);
        i.putExtra(EXTRA_ALARM_ID, alarmId);
        int code = ("snooze".equals(reason) ? 20000 : 1000) + alarmId;
        return PendingIntent.getBroadcast(ctx, code, i, immutableFlags());
    }

    /**
     * ضبط كل المواعيد الدقيقة: يلغي القديم ثم يجدول أول ظهور قادم
     * لكل منبه مفعّل (على ساعة الهاتف).
     * @return أقرب رنين قادم أو -1
     */
    public static long armAll(Context ctx) {
        cancelAll(ctx);
        Calendar now = Calendar.getInstance(); // ساعة الهاتف
        JSONArray alarms = AlarmPrefs.loadAlarms(ctx);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return -1;

        long nearest = -1;
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject alarm = alarms.optJSONObject(i);
            if (alarm == null || !alarm.optBoolean("active", false)) continue;
            if (AlarmPrefs.isExpired(ctx, alarm, now)) continue;
            int id = alarm.optInt("id", 0);
            if (id <= 0) continue;
            long t = AlarmPrefs.nextOccurrence(now, alarm);
            if (t < 0) continue;
            if (scheduleOne(am, ctx, id, t)) {
                if (nearest < 0 || t < nearest) nearest = t;
            }
        }
        return nearest;
    }

    /** جدولة موعد واحد (مع إسقاط آمن للأسفل) */
    private static boolean scheduleOne(AlarmManager am, Context ctx, int alarmId, long trigger) {
        PendingIntent fire = fireIntent(ctx, alarmId, "daily");
        try {
            if (canScheduleExact(ctx)) {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        AlarmClockInfo info = new AlarmClockInfo(trigger, showIntent(ctx, alarmId));
                        am.setAlarmClock(info, fire);
                    } else {
                        am.setExact(AlarmManager.RTC_WAKEUP, trigger, fire);
                    }
                    return true;
                } catch (Exception e) {
                    // إسقاط آمن للأسفل
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, fire);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, trigger, fire);
            }
            return true;
        } catch (Exception e) {
            // أسوأ الحالات: جدولة غير دقيقة (يرنّ متأخراً بدل أن لا يرنّ أبداً)
            try {
                am.set(AlarmManager.RTC_WAKEUP, trigger, fire);
                return true;
            } catch (Exception e2) {
                return false;
            }
        }
    }

    /** جدولة الغفوة لمنبه: إطلاق واحد بعد المدة المحددة */
    public static boolean armSnooze(Context ctx, int alarmId, long triggerAt) {
        if (alarmId <= 0) return false;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return false;
        PendingIntent fire = fireIntent(ctx, alarmId, "snooze");
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, fire);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, fire);
            }
            return true;
        } catch (Exception e) {
            try {
                am.set(AlarmManager.RTC_WAKEUP, triggerAt, fire);
                return true;
            } catch (Exception e2) {
                return false;
            }
        }
    }

    /** إلغاء كل المواعيد (اليومي + الغفوة) لكل المنبهات */
    public static void cancelAll(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        JSONArray alarms = AlarmPrefs.loadAlarms(ctx);
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject alarm = alarms.optJSONObject(i);
            if (alarm == null) continue;
            int id = alarm.optInt("id", 0);
            if (id <= 0) continue;
            try {
                am.cancel(fireIntent(ctx, id, "daily"));
            } catch (Exception ignored) {}
            try {
                am.cancel(fireIntent(ctx, id, "snooze"));
            } catch (Exception ignored) {}
        }
    }

    /** هل يمكن جدولة منبهات دقيقة؟ (أندرويد 12+ يحتاج إذن المستخدم) */
    public static boolean canScheduleExact(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
                if (am != null) return am.canScheduleExactAlarms();
            } catch (Exception ignored) {}
        }
        return true;
    }

    /** نية عرض أيقونة الساعة في شريط الحالة (تفتح الشاشة الرئيسية) */
    private static PendingIntent showIntent(Context ctx, int alarmId) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, 30000 + alarmId, i, immutableFlags());
    }

    /** فتح صفحة طلب إذن المنبه الدقيق (أندرويد 12+) */
    public static void openExactAlarmSettings(Context ctx) {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                i.setData(android.net.Uri.parse("package:" + ctx.getPackageName()));
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                i.setData(android.net.Uri.parse("package:" + ctx.getPackageName()));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception ignored) {}
    }

    /** هل الجهاز يتجاهل تحسينات البطارية للتطبيق؟ */
    public static boolean isIgnoringBatteryOptimizations(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                android.os.PowerManager pm = (android.os.PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
                if (pm != null) return pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
            } catch (Exception ignored) {}
        }
        return true;
    }

    public static void requestIgnoreBatteryOptimizations(Context ctx) {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                i.setData(android.net.Uri.parse("package:" + ctx.getPackageName()));
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                i.setData(android.net.Uri.parse("package:" + ctx.getPackageName()));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception ignored) {}
    }
}
