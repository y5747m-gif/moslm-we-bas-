package com.hatsally.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * حفظ إعدادات منبه الفجر في SharedPreferences ⚙️
 * - الصيغة: {"active":true,"time":"HH:MM","days":[0..6],"name":"...","lang":"ar|en"}
 * - الأيام: 0=الأحد ... 6=السبت (نفس تعريف JS)
 * - الحفظ هنا يجعل المنبه يُعاد ضبطه بعد إعادة تشغيل الهاتف
 *   حتى لو اقتُلع التطبيق من الذاكرة.
 */
public final class HatAlarmConfig {
    private static final String PREFS = "hatsally_alarm_prefs";
    private static final String KEY_CFG = "config_json";

    private HatAlarmConfig() {}

    public static String loadJson(Context ctx) {
        try {
            return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_CFG, "");
        } catch (Exception e) {
            return "";
        }
    }

    public static void saveJson(Context ctx, String json) {
        try {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_CFG, json)
                    .apply();
        } catch (Exception ignored) {}
    }

    public static JSONObject load(Context ctx) {
        String raw = loadJson(ctx);
        if (raw == null || raw.isEmpty()) return null;
        try {
            return new JSONObject(raw);
        } catch (JSONException e) {
            return null;
        }
    }

    public static boolean isActive(Context ctx) {
        JSONObject o = load(ctx);
        return o != null && o.optBoolean("active", false);
    }

    public static void markInactive(Context ctx) {
        JSONObject o = load(ctx);
        if (o == null) return;
        try {
            o.put("active", false);
            saveJson(ctx, o.toString());
        } catch (JSONException ignored) {}
    }

    /** يستخرج "HH:MM" أو null إن لم يكن صالحاً */
    public static String loadTime(Context ctx) {
        JSONObject o = load(ctx);
        if (o == null) return null;
        String t = o.optString("time", "");
        String[] parts = t.split(":");
        if (parts.length < 2) return null;
        try {
            int h = Integer.parseInt(parts[0]);
            int m = Integer.parseInt(parts[1]);
            if (h < 0 || h > 23 || m < 0 || m > 59) return null;
            return String.format("%02d:%02d", h, m);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** يستخرج أيام الأسبوع 0=Sun..6=Sat أو null */
    public static int[] loadDays(Context ctx) {
        JSONObject o = load(ctx);
        if (o == null) return null;
        JSONArray arr = o.optJSONArray("days");
        if (arr == null || arr.length() == 0) return null;
        int[] days = new int[arr.length()];
        for (int i = 0; i < arr.length(); i++) {
            int d = arr.optInt(i, -1);
            if (d < 0 || d > 6) d = 0;
            days[i] = d;
        }
        return days;
    }

    public static String loadName(Context ctx) {
        JSONObject o = load(ctx);
        if (o == null) return "";
        String n = o.optString("name", "");
        return n != null ? n : "";
    }

    public static String loadLang(Context ctx) {
        JSONObject o = load(ctx);
        if (o == null) return "ar";
        String l = o.optString("lang", "ar");
        return "en".equalsIgnoreCase(l) ? "en" : "ar";
    }
}
