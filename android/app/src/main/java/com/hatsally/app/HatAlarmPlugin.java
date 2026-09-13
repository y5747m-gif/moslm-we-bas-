package com.hatsally.app;

import org.json.JSONArray;
import org.json.JSONObject;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * HatAlarm - الجسر إلى محرك المنبه الدقيق 🕰
 * ---------------------------------------------------------------
 * يعرّض لـ JavaScript (lib/native.ts) محرك المنبهات الدقيقة
 * المربوط بساعة الهاتف:
 *
 *  schedule({time, days, name, lang}) : حفظ الإعدادات + جدولة
 *     مواعيد دقيقة على AlarmManager لكل يوم مختار
 *  cancel()    : إلغاء كل المواعيد + إيقاف الرنين
 *  stopRinging(): إيقاف خدمة الرنين (بعد اكتمال التحقق)
 *  startRinging(): بدء خدمة الرنين فوراً (لحظة اللحاق)
 *  state()     : {armed, ringing, next:[ms,...]}
 */
@CapacitorPlugin(name = "HatAlarm")
public class HatAlarmPlugin extends Plugin {

    @PluginMethod
    public void schedule(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            String time = call.getString("time", "05:00");
            JSONArray daysArr = call.getArray("days", null);
            String name = call.getString("name", "");
            String lang = call.getString("lang", "ar");

            String[] parts = (time == null ? "05:00" : time).split(":");
            int hour = clamp(parseIntSafe(parts[0], 5), 0, 23);
            int minute = clamp(parseIntSafe(parts.length > 1 ? parts[1] : "0", 0), 0, 59);

            int[] days;
            if (daysArr != null && daysArr.length() > 0) {
                days = new int[daysArr.length()];
                for (int i = 0; i < daysArr.length(); i++) {
                    days[i] = clamp(daysArr.optInt(i, 0), 0, 6);
                }
            } else {
                days = new int[]{0, 1, 2, 3, 4, 5, 6};
            }

            // 1) حفظ الإعدادات (للإعادة الضبط بعد الإقلاع/القتل)
            JSONObject cfg = new JSONObject();
            cfg.put("active", true);
            cfg.put("time", String.format("%02d:%02d", hour, minute));
            cfg.put("days", toJSONArray(days));
            cfg.put("name", name == null ? "" : name);
            cfg.put("lang", "en".equalsIgnoreCase(lang) ? "en" : "ar");
            HatAlarmConfig.saveJson(getContext(), cfg.toString());

            // 2) جدولة دقيقة على ساعة الهاتف
            long[] next = HatAlarmScheduler.armAll(getContext(), hour, minute, days);

            ret.put("ok", next != null);
            JSONArray arr = new JSONArray();
            if (next != null) {
                for (long t : next) arr.put(t);
            }
            ret.put("next", arr);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("ok", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            HatAlarmScheduler.cancelAll(getContext());
            HatAlarmConfig.markInactive(getContext());
            HatAlarmService.stop(getContext());
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void stopRinging(PluginCall call) {
        try {
            HatAlarmService.stop(getContext());
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void startRinging(PluginCall call) {
        try {
            HatAlarmService.start(getContext());
            // تأكد أن المواعيد القادمة مضبوطة (مسار اللحاق)
            HatAlarmScheduler.armFromPrefs(getContext());
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void state(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            boolean armed = HatAlarmConfig.isActive(getContext());
            ret.put("armed", armed);
            ret.put("ringing", HatAlarmService.isRunning());
            JSONArray arr = new JSONArray();
            long[] next = HatAlarmScheduler.nextFromPrefs(getContext());
            if (next != null) {
                for (long t : next) arr.put(t);
            }
            ret.put("next", arr);
        } catch (Exception ignored) {}
        call.resolve(ret);
    }

    // ------------------------------------------------------------------
    private static int parseIntSafe(String s, int fallback) {
        try {
            return Integer.parseInt(s.trim());
        } catch (Exception e) {
            return fallback;
        }
    }

    private static int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }

    private static JSONArray toJSONArray(int[] arr) {
        JSONArray ja = new JSONArray();
        for (int i : arr) ja.put(i);
        return ja;
    }
}
