package com.hatsally.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.net.Uri;
import android.annotation.SuppressLint;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.view.WindowManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * AlarmPower - المحرك الأصلي لمنبه الفجر ⏰🔊
 * ------------------------------------------------------------------
 * قسمان:
 *  أ) فرض الاستيقاظ أثناء الرنين: صوت أقصى + إيقاظ الشاشة فوق القفل +
 *     منع النوم + الأذونات الحرجة (منبه دقيق/بطارية/عدم إزعاج/ملء الشاشة).
 *  ب) محرك الجدولة الأصلي (الجديد): يحفظ المنبه في إعدادات أصلية،
 *     يجدوله عبر AlarmManager.setAlarmClock، يشغّل خدمة حارس أمامية
 *     بإشعار **مثبت لا يمكن إزالته**، ويرنّ حتى لو التطبيق مغلق تماماً.
 *
 * كل الدوال تُرجع كائن حالة موحّد (buildState) لتعرضه الواجهة بدقة.
 */
@CapacitorPlugin(name = "AlarmPower")
public class AlarmPowerPlugin extends Plugin {

    public static final String TAG = "HatSallyPlugin";

    /** إصدار المحرك الأصلي - تتحقق منه الواجهة لتعرف أن النسخة المثبتة حديثة */
    public static final int ENGINE_VERSION = 2;

    private PowerManager.WakeLock wakeLock;
    private int savedAlarmVolume = -1;
    private int savedMusicVolume = -1;

    // ==================================================================
    // أ) محرك الجدولة الأصلي + الحارس + الإشعار المثبت
    // ==================================================================

    /** رقم إصدار المحرك (تستخدمه الواجهة للتأكد من وجود الميزات الجديدة) */
    @PluginMethod
    public void engineVersion(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("version", ENGINE_VERSION);
        call.resolve(ret);
    }

    /**
     * تسليح المنبه: حفظ أصلي + جدولة دقيقة + تشغيل الحارس بالإشعار المثبت.
     * الخيارات: time "HH:MM", days [0..6], name, lang, startDate (ISO أو millis),
     * durationDays (رقم أو "forever"), graceMinutes.
     */
    @PluginMethod
    public void setAlarm(PluginCall call) {
        try {
            Context ctx = getContext();
            AlarmStore.Config cfg = AlarmStore.load(ctx);

            cfg.time = normalizeTime(readString(call, "time", cfg.time));
            cfg.days = readDays(call, cfg.days);
            cfg.name = readString(call, "name", cfg.name);
            String lang = readString(call, "lang", cfg.lang);
            cfg.lang = (lang != null && lang.toLowerCase(Locale.US).startsWith("en")) ? "en" : "ar";
            cfg.startMillis = readStartMillis(call, cfg.startMillis);
            cfg.durationDays = readDuration(call, cfg.durationDays);
            cfg.graceMinutes = readInt(call, "graceMinutes", AlarmStore.DEFAULT_GRACE_MINUTES);
            // تسليح جديد = يوم جديد (لا نرث علامة رنين قديم)
            Boolean keepFired = call.getBoolean("keepLastFired");
            if (keepFired == null || !keepFired) cfg.lastFiredKey = null;
            cfg.armed = true;

            AlarmStore.save(ctx, cfg);
            long next = AlarmScheduler.scheduleNext(ctx);
            // التطبيق في المقدمة الآن → بدء الخدمة الأمامية مسموح دائماً
            AlarmScheduler.startGuardService(ctx, AlarmGuardService.ACTION_GUARD);

            Log.i(TAG, "setAlarm " + cfg.time + " days=" + AlarmStore.joinDays(cfg.days)
                + " next=" + AlarmScheduler.describeNext(next));
            call.resolve(buildState(ctx));
        } catch (Throwable t) {
            Log.e(TAG, "setAlarm failed", t);
            call.reject("setAlarm failed: " + t.getMessage());
        }
    }

    /** إلغاء المنبه: إيقاف الجدولة + الحارس + الإشعار المثبت + الرنين */
    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        try {
            Context ctx = getContext();
            AlarmScheduler.cancel(ctx);
            AlarmStore.disarm(ctx);
            AlarmStore.setRinging(ctx, false);
            AlarmScheduler.stopGuardService(ctx);
            call.resolve(buildState(ctx));
        } catch (Throwable t) {
            Log.e(TAG, "cancelAlarm failed", t);
            call.reject("cancelAlarm failed: " + t.getMessage());
        }
    }

    /**
     * مزامنة عند فتح التطبيق/العودة إليه:
     * إعادة الجدولة + إحياء الحارس + اللحاق بالموعد الفائت ضمن المهلة.
     */
    @PluginMethod
    public void syncNow(PluginCall call) {
        try {
            Context ctx = getContext();
            AlarmStore.Config cfg = AlarmStore.load(ctx);
            if (cfg.armed) {
                long now = System.currentTimeMillis();
                long due = AlarmScheduler.dueRingMillis(cfg, now);
                if (due > 0L && !AlarmStore.isRinging(ctx)) {
                    AlarmStore.markFiredNow(ctx);
                    AlarmStore.setRinging(ctx, true);
                    AlarmScheduler.startGuardService(ctx, AlarmGuardService.ACTION_RING);
                } else {
                    AlarmScheduler.startGuardService(ctx, AlarmGuardService.ACTION_GUARD);
                }
                AlarmScheduler.scheduleNext(ctx);
            } else {
                AlarmScheduler.cancel(ctx);
            }
            call.resolve(buildState(ctx));
        } catch (Throwable t) {
            Log.e(TAG, "syncNow failed", t);
            call.reject("syncNow failed: " + t.getMessage());
        }
    }

    /** حالة المحرك الكاملة (للعرض والتشخيص) */
    @PluginMethod
    public void getState(PluginCall call) {
        try {
            call.resolve(buildState(getContext()));
        } catch (Throwable t) {
            call.reject("getState failed: " + t.getMessage());
        }
    }

    /** بدء الرنين الأصلي (لو رنّ محرك الويب أولاً نوحّد الصوت الأصلي معه) */
    @PluginMethod
    public void startRinging(PluginCall call) {
        try {
            Context ctx = getContext();
            // لا نغيّر تسليح المستخدم: الرنين اليدوي/الاختباري يعمل مستقلاً
            AlarmStore.setRinging(ctx, true);
            AlarmScheduler.startGuardService(ctx, AlarmGuardService.ACTION_RING_FORCE);
            call.resolve(buildState(ctx));
        } catch (Throwable t) {
            call.reject("startRinging failed: " + t.getMessage());
        }
    }

    /** إيقاف الرنين الأصلي (بعد اكتمال التحقق بالتصوير) */
    @PluginMethod
    public void stopRinging(PluginCall call) {
        try {
            Context ctx = getContext();
            AlarmStore.setRinging(ctx, false);
            AlarmGuardService.requestStopRinging(ctx);
            AlarmScheduler.scheduleNext(ctx);
            call.resolve(buildState(ctx));
        } catch (Throwable t) {
            call.reject("stopRinging failed: " + t.getMessage());
        }
    }

    /** علّم أن اليوم رنّ (يمنع تكرار الرنين في نفس اليوم) */
    @PluginMethod
    public void markFired(PluginCall call) {
        try {
            Context ctx = getContext();
            AlarmStore.markFiredNow(ctx);
            AlarmScheduler.scheduleNext(ctx);
            call.resolve(buildState(ctx));
        } catch (Throwable t) {
            call.reject("markFired failed: " + t.getMessage());
        }
    }

    /**
     * اختبار حقيقي للمسار الكامل: جدولة موعد فعلي بعد delaySeconds
     * فيرنّ الهاتف بالضبط كما يرنّ وقت الفجر (صوت + اهتزاز + إشعار).
     */
    @PluginMethod
    public void testRing(PluginCall call) {
        try {
            Context ctx = getContext();
            int delay = readInt(call, "delaySeconds", 20);
            if (delay < 5) delay = 5;
            if (delay > 600) delay = 600;
            long at = System.currentTimeMillis() + (delay * 1000L);

            AlarmStore.Config cfg = AlarmStore.load(ctx);
            boolean wasArmed = cfg.armed;
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) {
                call.reject("AlarmManager unavailable");
                return;
            }
            // PendingIntent مستقل: لا يُلغي الموعد الحقيقي ولا يستهلك رنين اليوم
            PendingIntent pi = AlarmScheduler.testPendingIntent(ctx);
            try {
                am.setAlarmClock(
                    new AlarmManager.AlarmClockInfo(at, AlarmScheduler.openAppPendingIntent(ctx)),
                    pi
                );
            } catch (Throwable t) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            }
            AlarmScheduler.startGuardService(ctx, AlarmGuardService.ACTION_GUARD);

            JSObject ret = buildState(ctx);
            ret.put("testAt", at);
            ret.put("testWasArmed", wasArmed);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("testRing failed: " + t.getMessage());
        }
    }

    // ==================================================================
    // أذونات إضافية (ملء الشاشة + الإشعارات)
    // ==================================================================

    /** هل يسمح النظام بإشعار ملء الشاشة (يوقظ الشاشة فوق القفل)؟ */
    @PluginMethod
    public void hasFullScreenIntent(PluginCall call) {
        boolean allowed = true;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                NotificationManager nm =
                    (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) allowed = nm.canUseFullScreenIntent();
            }
        } catch (Throwable t) {
            allowed = true;
        }
        JSObject ret = new JSObject();
        ret.put("value", allowed);
        call.resolve(ret);
    }

    @PluginMethod
    public void openFullScreenIntentSettings(PluginCall call) {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Throwable t) {
            openAppDetails(call);
        }
    }

    /** فتح شاشة إعدادات إشعارات التطبيق (لتفعيل القنوات إن أُغلقت) */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Throwable t) {
            openAppDetails(call);
        }
    }

    private void openAppDetails(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            i.setData(Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Throwable t) {
            call.reject(t.getMessage());
        }
    }

    // ==================================================================
    // ب) فرض الاستيقاظ (كما كان) + الأذونات الحرجة
    // ==================================================================

    @PluginMethod
    @SuppressLint("NewApi") // محمي بشرط SDK_INT >= S داخل الدالة
    public void canScheduleExactAlarms(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", AlarmScheduler.canScheduleExact(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    @SuppressLint("NewApi") // محمي بشرط SDK_INT >= S داخل الدالة
    public void openExactAlarmSettings(PluginCall call) {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", AlarmScheduler.isIgnoringBatteryOptimizations(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void hasDndAccess(PluginCall call) {
        boolean granted = true;
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) granted = nm.isNotificationPolicyAccessGranted();
        JSObject ret = new JSObject();
        ret.put("value", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openDndSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void setVolumeMax(PluginCall call) {
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            JSObject ret = new JSObject();
            if (am != null) {
                if (savedAlarmVolume < 0) {
                    savedAlarmVolume = am.getStreamVolume(AudioManager.STREAM_ALARM);
                    savedMusicVolume = am.getStreamVolume(AudioManager.STREAM_MUSIC);
                }
                am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
                am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), 0);
                ret.put("maxed", true);
            } else {
                ret.put("maxed", false);
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void restoreVolume(PluginCall call) {
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (am != null && savedAlarmVolume >= 0) {
                am.setStreamVolume(AudioManager.STREAM_ALARM, savedAlarmVolume, 0);
                am.setStreamVolume(AudioManager.STREAM_MUSIC, savedMusicVolume, 0);
                savedAlarmVolume = -1;
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void acquireWakeLock(PluginCall call) {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HatSally::AlarmWakeLock");
                    wakeLock.setReferenceCounted(false);
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(10 * 60 * 1000L);
            }
            if (getActivity() != null) {
                getActivity().runOnUiThread(() -> {
                    if (getActivity() != null) {
                        getActivity().getWindow().addFlags(
                            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    }
                });
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void releaseWakeLock(PluginCall call) {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            if (getActivity() != null) {
                getActivity().runOnUiThread(() -> {
                    if (getActivity() != null) {
                        getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    }
                });
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    // ==================================================================
    // أدوات
    // ==================================================================

    private JSObject buildState(Context ctx) {
        AlarmStore.Config cfg = AlarmStore.load(ctx);
        long now = System.currentTimeMillis();
        long next = AlarmScheduler.computeNextFire(cfg, now);
        long scheduledAt = AlarmStore.scheduledAt(ctx);

        JSObject ret = new JSObject();
        ret.put("engineVersion", ENGINE_VERSION);
        ret.put("armed", cfg.armed);
        ret.put("ringing", AlarmStore.isRinging(ctx));
        ret.put("ringStartedAt", AlarmStore.ringStartedAt(ctx));
        ret.put("time", cfg.time);
        ret.put("days", AlarmStore.joinDays(cfg.days));
        ret.put("name", cfg.name);
        ret.put("lang", cfg.lang);
        ret.put("durationDays", cfg.durationDays);
        ret.put("startMillis", cfg.startMillis);
        ret.put("lastFiredKey", cfg.lastFiredKey == null ? "" : cfg.lastFiredKey);
        ret.put("graceMinutes", cfg.graceMinutes);
        ret.put("nextFireAt", next);
        ret.put("nextFireIso", next > 0L ? iso(next) : "");
        ret.put("nextFireText", next > 0L ? AlarmTexts.whenText(next, cfg.lang) : "");
        ret.put("scheduledAt", scheduledAt);
        ret.put("alarmPendingInSystem", scheduledAt > now);
        ret.put("systemNextAlarmAt", systemNextAlarmClock(ctx));
        ret.put("serviceRunning", AlarmGuardService.isRunning());
        ret.put("exactAlarms", AlarmScheduler.canScheduleExact(ctx));
        ret.put("ignoringBattery", AlarmScheduler.isIgnoringBatteryOptimizations(ctx));
        ret.put("notificationsEnabled", notificationsEnabled(ctx));
        ret.put("fullScreenIntent", fullScreenIntentAllowed(ctx));
        ret.put("dueNow", AlarmScheduler.dueRingMillis(cfg, now) > 0L);
        ret.put("expired", AlarmScheduler.isExpired(cfg, now));
        return ret;
    }

    private long systemNextAlarmClock(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return 0L;
            AlarmManager.AlarmClockInfo info = am.getNextAlarmClock();
            return info != null ? info.getTriggerTime() : 0L;
        } catch (Throwable t) {
            return 0L;
        }
    }

    private boolean notificationsEnabled(Context ctx) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
                return nm != null && nm.areNotificationsEnabled();
            }
        } catch (Throwable ignored) {
            // لا شيء
        }
        return true;
    }

    private boolean fullScreenIntentAllowed(Context ctx) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
                return nm != null && nm.canUseFullScreenIntent();
            }
        } catch (Throwable ignored) {
            // لا شيء
        }
        return true;
    }

    private static String iso(long millis) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            return f.format(new Date(millis));
        } catch (Throwable t) {
            return "";
        }
    }

    private static String normalizeTime(String time) {
        int[] hm = AlarmScheduler.parseTime(time);
        if (hm == null) return "05:00";
        return String.format(Locale.US, "%02d:%02d", hm[0], hm[1]);
    }

    private static long parseIso8601(String iso) {
        if (iso == null || iso.trim().length() == 0) return 0L;
        String value = iso.trim();
        String[] patterns = {
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
            "yyyy-MM-dd'T'HH:mm:ssZ",
            "yyyy-MM-dd'T'HH:mm",
            "yyyy-MM-dd"
        };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat f = new SimpleDateFormat(pattern, Locale.US);
                f.setLenient(false);
                if (pattern.endsWith("'Z'")) f.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date d = f.parse(value);
                if (d != null) return d.getTime();
            } catch (Throwable ignored) {
                // جرّب النمط التالي
            }
        }
        try {
            return (long) Double.parseDouble(value);
        } catch (Throwable ignored) {
            return 0L;
        }
    }

    private static Object raw(PluginCall call, String name) {
        try {
            return call.getData().opt(name);
        } catch (Throwable t) {
            return null;
        }
    }

    private static String readString(PluginCall call, String name, String fallback) {
        Object v = raw(call, name);
        if (v == null) return fallback;
        String s = v.toString();
        return s.length() == 0 ? fallback : s;
    }

    private static int readInt(PluginCall call, String name, int fallback) {
        Object v = raw(call, name);
        if (v == null) return fallback;
        if (v instanceof Number) return ((Number) v).intValue();
        try {
            if ("forever".equalsIgnoreCase(v.toString())) return AlarmStore.FOREVER;
            return (int) Double.parseDouble(v.toString());
        } catch (Throwable t) {
            return fallback;
        }
    }

    private static long readLong(PluginCall call, String name, long fallback) {
        Object v = raw(call, name);
        if (v == null) return fallback;
        if (v instanceof Number) return ((Number) v).longValue();
        try {
            return (long) Double.parseDouble(v.toString());
        } catch (Throwable t) {
            return fallback;
        }
    }

    private int[] readDays(PluginCall call, int[] fallback) {
        try {
            JSArray arr = call.getArray("days");
            if (arr == null || arr.length() == 0) return fallback;
            int[] tmp = new int[arr.length()];
            int n = 0;
            for (int i = 0; i < arr.length(); i++) {
                Object v = arr.opt(i);
                if (v instanceof Number) {
                    int d = ((Number) v).intValue();
                    if (d >= 0 && d <= 6) tmp[n++] = d;
                }
            }
            if (n == 0) return fallback;
            int[] out = new int[n];
            System.arraycopy(tmp, 0, out, 0, n);
            return out;
        } catch (Throwable t) {
            // قد تأتي كنص "0,1,2"
            String csv = readString(call, "days", null);
            if (csv != null) return AlarmStore.parseDays(csv);
            return fallback;
        }
    }

    private long readStartMillis(PluginCall call, long fallback) {
        long millis = readLong(call, "startMillis", 0L);
        if (millis > 0L) return millis;
        String iso = readString(call, "startDate", null);
        if (iso != null) {
            long parsed = parseIso8601(iso);
            if (parsed > 0L) return parsed;
        }
        return fallback;
    }

    private int readDuration(PluginCall call, int fallback) {
        Object v = raw(call, "durationDays");
        if (v == null) return fallback;
        if (v instanceof Number) {
            int d = ((Number) v).intValue();
            return d > 0 ? d : AlarmStore.FOREVER;
        }
        String s = v.toString().trim();
        if ("forever".equalsIgnoreCase(s) || s.length() == 0) return AlarmStore.FOREVER;
        try {
            int d = (int) Double.parseDouble(s);
            return d > 0 ? d : AlarmStore.FOREVER;
        } catch (Throwable t) {
            return fallback;
        }
    }
}
