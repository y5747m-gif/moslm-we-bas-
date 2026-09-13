package com.hatsally.nativeapp;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Date;

/**
 * حفظ منبهات الفجر (عدة منبهات) ⚙️
 * ---------------------------------------------------------------
 * الصيغة:
 * {
 *   "lang": "ar", "theme": "dark",
 *   "alarms": [
 *     {"id":1, "name":"أحمد", "time":"05:00", "days":[0,1,2,3,4],
 *      "duration":0, "startDate":"2026-09-13",
 *      "active":true, "lastFiredKey":""},
 *     ...
 *   ]
 * }
 * الأيام: 0=الأحد ... 6=السبت | duration: 0=دائم
 */
public final class AlarmPrefs {
    private static final String PREFS = "hatsally_native_prefs";
    private static final String KEY_CFG = "config_json";

    private AlarmPrefs() {}

    private static SharedPreferences sp(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ------------------------------------------------------------------
    // جذر الإعدادات
    // ------------------------------------------------------------------
    public static JSONObject loadRoot(Context ctx) {
        String raw = sp(ctx).getString(KEY_CFG, "");
        JSONObject o = null;
        if (raw != null && !raw.isEmpty()) {
            try {
                o = new JSONObject(raw);
            } catch (Exception ignored) {}
        }
        if (o == null) o = new JSONObject();
        migrateIfNeeded(o);
        return o;
    }

    public static void saveRoot(Context ctx, JSONObject o) {
        try {
            sp(ctx).edit().putString(KEY_CFG, o.toString()).apply();
        } catch (Exception ignored) {}
    }

    /** ترحيل الصيغة القديمة (منبه واحد) إلى قائمة منبهات */
    private static void migrateIfNeeded(JSONObject o) {
        try {
            if (o.has("alarms")) return;
            if (!o.has("time")) return;
            JSONArray arr = new JSONArray();
            JSONObject a = new JSONObject();
            a.put("id", 1);
            a.put("name", o.optString("name", ""));
            a.put("time", o.optString("time", "05:00"));
            JSONArray days = o.optJSONArray("days");
            a.put("days", days != null && days.length() > 0 ? days : new JSONArray());
            a.put("duration", o.optInt("duration", 0));
            a.put("startDate", o.optString("startDate", ""));
            a.put("active", o.optBoolean("active", false));
            a.put("lastFiredKey", o.optString("lastFiredKey", ""));
            arr.put(a);
            o.put("alarms", arr);
        } catch (Exception ignored) {}
    }

    // ------------------------------------------------------------------
    // قائمة المنبهات
    // ------------------------------------------------------------------
    public static JSONArray loadAlarms(Context ctx) {
        JSONObject root = loadRoot(ctx);
        JSONArray arr = root.optJSONArray("alarms");
        if (arr == null) arr = new JSONArray();
        return arr;
    }

    public static void saveAlarms(Context ctx, JSONArray arr) {
        JSONObject root = loadRoot(ctx);
        try {
            root.put("alarms", arr);
            saveRoot(ctx, root);
        } catch (Exception ignored) {}
    }

    /** المنبه بالمعرّف أو null */
    public static JSONObject findAlarm(Context ctx, int id) {
        JSONArray arr = loadAlarms(ctx);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject a = arr.optJSONObject(i);
            if (a != null && a.optInt("id", -1) == id) return a;
        }
        return null;
    }

    /** أول منبه مفعّل أو null */
    public static JSONObject firstActiveAlarm(Context ctx) {
        JSONArray arr = loadAlarms(ctx);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject a = arr.optJSONObject(i);
            if (a != null && a.optBoolean("active", false)) return a;
        }
        return null;
    }

    public static int nextAlarmId(Context ctx) {
        JSONArray arr = loadAlarms(ctx);
        int max = 0;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject a = arr.optJSONObject(i);
            if (a != null) max = Math.max(max, a.optInt("id", 0));
        }
        return max + 1;
    }

    /** إضافة منبه جديد (يُضبط معرّفه تلقائياً) */
    public static void addAlarm(Context ctx, JSONObject alarm) {
        JSONArray arr = loadAlarms(ctx);
        try {
            if (alarm.optInt("id", 0) <= 0) alarm.put("id", nextAlarmId(ctx));
            if (!alarm.has("active")) alarm.put("active", true);
            if (!alarm.has("lastFiredKey")) alarm.put("lastFiredKey", "");
            arr.put(alarm);
            saveAlarms(ctx, arr);
        } catch (Exception ignored) {}
    }

    /** تحديث منبه موجود */
    public static void updateAlarm(Context ctx, int id, JSONObject updated) {
        JSONArray arr = loadAlarms(ctx);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject a = arr.optJSONObject(i);
            if (a != null && a.optInt("id", -1) == id) {
                arr.put(i, updated);
                saveAlarms(ctx, arr);
                return;
            }
        }
    }

    public static void removeAlarm(Context ctx, int id) {
        JSONArray arr = loadAlarms(ctx);
        JSONArray out = new JSONArray();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject a = arr.optJSONObject(i);
            if (a == null || a.optInt("id", -1) != id) out.put(a);
        }
        saveAlarms(ctx, out);
    }

    /** تفعيل/تعطيل منبه */
    public static void setActive(Context ctx, int id, boolean active) {
        JSONObject a = findAlarm(ctx, id);
        if (a == null) return;
        try {
            a.put("active", active);
            if (active) a.put("lastFiredKey", "");
            updateAlarm(ctx, id, a);
        } catch (Exception ignored) {}
    }

    public static void setLastFired(Context ctx, int id, String key) {
        JSONObject a = findAlarm(ctx, id);
        if (a == null) return;
        try {
            a.put("lastFiredKey", key);
            updateAlarm(ctx, id, a);
        } catch (Exception ignored) {}
    }

    public static String getLastFired(Context ctx, int id) {
        JSONObject a = findAlarm(ctx, id);
        if (a == null) return "";
        return a.optString("lastFiredKey", "");
    }

    public static int countActive(Context ctx) {
        JSONArray arr = loadAlarms(ctx);
        int n = 0;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject a = arr.optJSONObject(i);
            if (a != null && a.optBoolean("active", false)) n++;
        }
        return n;
    }

    // ------------------------------------------------------------------
    // اللغة والمظهر
    // ------------------------------------------------------------------
    public static String loadLang(Context ctx) {
        JSONObject root = loadRoot(ctx);
        String l = root.optString("lang", "ar");
        return "en".equalsIgnoreCase(l) ? "en" : "ar";
    }

    public static void setLang(Context ctx, String lang) {
        JSONObject root = loadRoot(ctx);
        try {
            root.put("lang", "en".equals(lang) ? "en" : "ar");
            saveRoot(ctx, root);
        } catch (Exception ignored) {}
    }

    public static String loadTheme(Context ctx) {
        JSONObject root = loadRoot(ctx);
        return root.optString("theme", "dark");
    }

    public static void setTheme(Context ctx, String theme) {
        JSONObject root = loadRoot(ctx);
        try {
            root.put("theme", "light".equals(theme) ? "light" : "dark");
            saveRoot(ctx, root);
        } catch (Exception ignored) {}
    }

    // ------------------------------------------------------------------
    // حساب المواعيد (على ساعة الهاتف)
    // ------------------------------------------------------------------

    /** مفتاح اليوم المحلي yyyy-mm-dd */
    /** مفتاح غفوة لكل منبه: "سُخِّرت الغفوة لهذا المنبه في هذا اليوم" */
    public static String getSnoozeKey(Context ctx, int alarmId) {
        JSONObject a = findAlarm(ctx, alarmId);
        if (a == null) return "";
        return a.optString("snoozeUsedKey", "");
    }

    public static void setSnoozeKey(Context ctx, int alarmId, String key) {
        JSONObject a = findAlarm(ctx, alarmId);
        if (a == null) return;
        try {
            a.put("snoozeUsedKey", key);
            updateAlarm(ctx, alarmId, a);
        } catch (Exception ignored) {}
    }

    public static String todayKey(Calendar now) {
        return String.format("%04d-%02d-%02d",
                now.get(Calendar.YEAR),
                now.get(Calendar.MONTH) + 1,
                now.get(Calendar.DAY_OF_MONTH));
    }

    /** هل ينطلق المنبه في هذا اليوم؟ */
    public static boolean dayMatches(JSONObject alarm, int jsDay) {
        JSONArray days = alarm.optJSONArray("days");
        if (days == null || days.length() == 0) return true; // بدون أيام = كل الأيام
        for (int i = 0; i < days.length(); i++) {
            if (days.optInt(i, -1) == jsDay) return true;
        }
        return false;
    }

    /** هل انتهت مدة المنبه المحدودة؟ */
    public static boolean isExpired(Context ctx, JSONObject alarm, Calendar now) {
        int dur = alarm.optInt("duration", 0);
        if (dur <= 0) return false;
        String startStr = alarm.optString("startDate", "");
        if (startStr == null || startStr.isEmpty()) return false;
        String[] p = startStr.split("-");
        if (p.length < 3) return false;
        try {
            int sy = Integer.parseInt(p[0]);
            int sm = Integer.parseInt(p[1]) - 1;
            int sd = Integer.parseInt(p[2]);
            Calendar start = Calendar.getInstance();
            start.clear();
            start.set(sy, sm, sd);
            Calendar nowDay = (Calendar) now.clone();
            nowDay.set(Calendar.HOUR_OF_DAY, 0);
            nowDay.set(Calendar.MINUTE, 0);
            nowDay.set(Calendar.SECOND, 0);
            nowDay.set(Calendar.MILLISECOND, 0);
            long diffDays = (nowDay.getTimeInMillis() - start.getTimeInMillis()) / 86400000L;
            if (diffDays >= dur) {
                // انقضى المنبه: عطّله تلقائياً
                setActive(ctx, alarm.optInt("id", 0), false);
                return true;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * أول رنين قادم لمنبه (على ساعة الهاتف) - أو -1 إن تعذر
     */
    public static long nextOccurrence(Calendar now, JSONObject alarm) {
        String time = alarm.optString("time", "");
        String[] parts = time.split(":");
        int h, m;
        try {
            h = Integer.parseInt(parts[0]);
            m = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
        } catch (Exception e) {
            return -1;
        }
        if (h < 0 || h > 23 || m < 0 || m > 59) return -1;

        JSONArray days = alarm.optJSONArray("days");
        int[] jsDays;
        if (days == null || days.length() == 0) {
            jsDays = new int[]{0, 1, 2, 3, 4, 5, 6};
        } else {
            jsDays = new int[days.length()];
            for (int i = 0; i < days.length(); i++) jsDays[i] = days.optInt(i, 0);
        }

        long best = -1;
        for (int jsDay : jsDays) {
            Calendar c = (Calendar) now.clone();
            c.set(Calendar.HOUR_OF_DAY, h);
            c.set(Calendar.MINUTE, m);
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);
            int target = jsDay + 1; // Calendar: 1=الأحد..7=السبت
            int delta = (target - c.get(Calendar.DAY_OF_WEEK) + 7) % 7;
            c.add(Calendar.DAY_OF_MONTH, delta);
            if (!c.after(now)) c.add(Calendar.DAY_OF_MONTH, 7);
            long t = c.getTimeInMillis();
            if (best < 0 || t < best) best = t;
        }
        return best;
    }

    /** أقرب رنين بين كل المنبهات المفعّلة - أو -1 */
    public static long nearestNext(Context ctx, Calendar now) {
        JSONArray arr = loadAlarms(ctx);
        long best = -1;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject a = arr.optJSONObject(i);
            if (a == null || !a.optBoolean("active", false)) continue;
            if (isExpired(ctx, a, now)) continue;
            long t = nextOccurrence(now, a);
            if (t > 0 && (best < 0 || t < best)) best = t;
        }
        return best;
    }

    /** بيانات المنبه الرنّان (للعرض) */
    public static String alarmName(Context ctx, int id) {
        JSONObject a = id > 0 ? findAlarm(ctx, id) : firstActiveAlarm(ctx);
        if (a != null) {
            String n = a.optString("name", "");
            if (!n.isEmpty()) return n;
        }
        return "ar".equals(loadLang(ctx)) ? "بطل الفجر" : "Fajr Hero";
    }

    public static String alarmTime(Context ctx, int id) {
        JSONObject a = id > 0 ? findAlarm(ctx, id) : firstActiveAlarm(ctx);
        if (a != null) {
            String t = a.optString("time", "");
            if (t.length() == 5) return t;
        }
        return "--:--";
    }

    /** تنسيق وقت لعرضه (HH:mm) */
    public static String formatTime(long ms) {
        java.text.SimpleDateFormat f = new java.text.SimpleDateFormat(
                "HH:mm", java.util.Locale.US);
        return f.format(new Date(ms));
    }
}
