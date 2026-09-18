package com.hatsally.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

/**
 * خدمة الحارس 🛡 — الخدمة الأمامية التي تجعل المنبه لا يموت
 * ------------------------------------------------------------------
 * المطلوب منها ثلاثة أشياء:
 *  1) إشعار **مثبت** في شريط الإشعارات لا يستطيع المستخدم إزالته
 *     (ongoing + FLAG_NO_CLEAR + deleteIntent يعيده فوراً + إعادة نشر
 *     دورية كل 20 ثانية). وجود هذه الخدمة الأمامية هو ما يجعل أندرويد
 *     لا يقتل التطبيق عند إغلاقه من التطبيقات الأخيرة.
 *  2) إبقاء المحرك حياً: تفحص دوري يعيد جدولة المنبه لو ضاع، ويلحق
 *     بالموعد الفائت فوراً (catch-up) حتى لو تعطّل AlarmManager.
 *  3) الرنين الأصلي الكامل (صوت + اهتزاز + نداء بالاسم + إيقاظ الشاشة
 *     + إشعار ملء الشاشة) بدون أي اعتماد على الـ WebView.
 *
 * START_STICKY + onTaskRemoved: تعود الخدمة تلقائياً بعد القتل أو
 * إغلاق التطبيق من شاشة التطبيقات الأخيرة.
 */
public class AlarmGuardService extends Service {

    public static final String TAG = "HatSallyGuard";

    public static final String ACTION_GUARD = "com.hatsally.app.action.GUARD";
    public static final String ACTION_RING = "com.hatsally.app.action.RING";
    /** رنين اختياري/يدوي من الواجهة (يعمل حتى لو المنبه غير مسلح) */
    public static final String ACTION_RING_FORCE = "com.hatsally.app.action.RING_FORCE";
    public static final String ACTION_STOP_RING = "com.hatsally.app.action.STOP_RING";
    public static final String ACTION_REPOST = "com.hatsally.app.action.REPOST";
    public static final String ACTION_STOP_ALL = "com.hatsally.app.action.STOP_ALL";

    public static final String CHANNEL_GUARD = "hatsally_guard";
    public static final String CHANNEL_ALARM = "hatsally_alarm";

    public static final int GUARD_NOTIFICATION_ID = 7001;
    public static final int RING_NOTIFICATION_ID = 7002;

    /** فحص دوري: إعادة نشر الإشعار المثبت + التحقق من الجدولة */
    private static final long TICK_MS = 20000L;
    /** حد أمان: لا يظل الهاتف يصرخ للأبد لو تعذّر التحقق (ساعة كاملة) */
    private static final long MAX_RING_MS = 60 * 60 * 1000L;
    private static final int REQ_DELETE = 4103;

    private static volatile boolean instanceRunning = false;
    /** حد أمان ضد حلقة إعادة تشغيل لا تنتهي: 3 محاولات كل 10 دقائق */
    private static int ringRestarts = 0;
    private static long ringRestartWindow = 0L;

    private AlarmRinger ringer;
    private Handler handler;
    private NotificationManager nm;
    private boolean foregroundStarted = false;

    private final Runnable tick =
        new Runnable() {
            @Override
            public void run() {
                try {
                    heartbeat();
                } catch (Throwable t) {
                    Log.w(TAG, "tick failed: " + t.getMessage());
                }
                if (handler != null) handler.postDelayed(this, TICK_MS);
            }
        };

    /** هل الخدمة تعمل الآن؟ (للعرض في الواجهة) */
    public static boolean isRunning() {
        return instanceRunning;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instanceRunning = true;
        nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        ringer = new AlarmRinger(this);
        handler = new Handler(Looper.getMainLooper());
        createChannels();
        Log.i(TAG, "guard service created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_GUARD;
        if (action == null) action = ACTION_GUARD;
        Log.i(TAG, "onStartCommand: " + action);

        if (ACTION_STOP_ALL.equals(action)) {
            stopEverything();
            return START_NOT_STICKY;
        }

        // يجب أن نصبح خدمة أمامية فوراً (أندرويد يمهلنا 5 ثوانٍ فقط)
        ensureForeground();

        if (ACTION_RING.equals(action)) {
            beginRinging(false);
        } else if (ACTION_RING_FORCE.equals(action)) {
            beginRinging(true);
        } else if (ACTION_STOP_RING.equals(action)) {
            stopRinging();
        }

        // GUARD / REPOST / START_STICKY → تحديث الإشعار المثبت وإعادته إن حُذف
        heartbeat();

        if (handler != null) {
            handler.removeCallbacks(tick);
            handler.postDelayed(tick, TICK_MS);
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // المستخدم أغلق التطبيق من التطبيقات الأخيرة: الحارس يبقى!
        Log.i(TAG, "task removed - guard keeps working");
        AlarmStore.Config cfg = AlarmStore.load(this);
        if (cfg.armed || ringer.isRunning()) {
            AlarmScheduler.scheduleNext(this);
            AlarmScheduler.startGuardService(this, ACTION_GUARD);
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        instanceRunning = false;
        if (handler != null) handler.removeCallbacks(tick);
        if (ringer != null && ringer.isRunning()) {
            // إن قُتلت الخدمة أثناء الرنين: أعد تشغيلها (بحد أمان ضد الحلقات)
            AlarmStore.Config cfg = AlarmStore.load(this);
            long now = System.currentTimeMillis();
            if (now - ringRestartWindow > 10 * 60 * 1000L) {
                ringRestartWindow = now;
                ringRestarts = 0;
            }
            if (cfg.armed && ringRestarts < 3) {
                ringRestarts++;
                Log.w(TAG, "killed while ringing - restarting (" + ringRestarts + "/3)");
                AlarmScheduler.startGuardService(this, ACTION_RING);
            }
            ringer.stop();
        }
        Log.i(TAG, "guard service destroyed");
        super.onDestroy();
    }

    // ------------------------------------------------------------------
    // النبض: إشعار مثبت + ضمان الجدولة + لحاق بالموعد
    // ------------------------------------------------------------------

    private void heartbeat() {
        long now = System.currentTimeMillis();
        AlarmStore.Config cfg = AlarmStore.load(this);

        if (!cfg.armed && !ringer.isRunning()) {
            stopEverything();
            return;
        }

        if (ringer.isRunning()) {
            // أمان: لو أوقفت الواجهة الرنين من مكان آخر
            if (!AlarmStore.isRinging(this)) {
                stopRinging();
            } else {
                long started = AlarmStore.ringStartedAt(this);
                if (started > 0L && now - started > MAX_RING_MS) {
                    Log.w(TAG, "ring safety cap reached - stopping sound");
                    stopRinging();
                }
            }
        } else {
            // المنبه مسلح ولا يرن: تأكد أن الموعد ما زال مجدولاً في النظام
            long scheduledAt = AlarmStore.scheduledAt(this);
            if (scheduledAt <= 0L || scheduledAt <= now) {
                long due = AlarmScheduler.dueRingMillis(cfg, now);
                if (due > 0L) {
                    // فات الموعد ضمن المهلة ولم نرنّ → ارنّ الآن (لحاق)
                    Log.i(TAG, "catch-up ring (alarm was due " + (now - due) / 60000L + " min ago)");
                    beginRinging(false);
                } else {
                    AlarmScheduler.scheduleNext(this);
                }
            }
        }

        cfg = AlarmStore.load(this);
        postGuardNotification(cfg, now);
        if (ringer.isRunning()) postRingNotification(cfg, now);
    }

    // ------------------------------------------------------------------
    // الرنين
    // ------------------------------------------------------------------

    /**
     * بدء الرنين الأصلي الكامل.
     * @param force صحيح لو الطلب من الواجهة (اختبار/رنين محرك الويب) فيعمل
     *              حتى لو المنبه غير مسلح، وبدون تعليم اليوم أو إعادة جدولة.
     */
    private void beginRinging(boolean force) {
        AlarmStore.Config cfg = AlarmStore.load(this);
        if (!cfg.armed && !force) {
            Log.w(TAG, "ring requested but alarm is not armed");
            stopEverything();
            return;
        }
        long now = System.currentTimeMillis();
        boolean alreadyRinging = AlarmStore.isRinging(this);
        AlarmStore.setRinging(this, true);
        if (cfg.armed && !alreadyRinging) {
            AlarmStore.markFiredNow(this); // مرة واحدة فقط في اليوم
        }
        ringer.start(cfg);
        postRingNotification(cfg, now);
        postGuardNotification(cfg, now);
        if (cfg.armed) {
            // جدولة الموعد القادم فوراً (حتى لو استمر الرنين طويلاً)
            AlarmScheduler.scheduleNext(this);
        }
        // افتح الواجهة فوق شاشة القفل (وإلا فإشعار ملء الشاشة يتكفل بذلك)
        openAppOverLockscreen();
    }

    private void stopRinging() {
        AlarmStore.setRinging(this, false);
        if (ringer != null) ringer.stop();
        if (nm != null) {
            try {
                nm.cancel(RING_NOTIFICATION_ID);
            } catch (Throwable ignored) {
                // لا شيء
            }
        }
        AlarmStore.Config cfg = AlarmStore.load(this);
        if (!cfg.armed) {
            stopEverything();
            return;
        }
        AlarmScheduler.scheduleNext(this);
        postGuardNotification(cfg, System.currentTimeMillis());
    }

    /** فتح الواجهة فوق شاشة القفل (الطريقة الرسمية هي إشعار ملء الشاشة) */
    private void openAppOverLockscreen() {
        try {
            Intent i = new Intent(this, MainActivity.class);
            i.setAction(Intent.ACTION_VIEW);
            i.setData(Uri.parse("hatsally://alarm?fire=1"));
            i.setPackage(getPackageName());
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            i.putExtra("hatsally_fire", true);
            startActivity(i);
        } catch (Throwable t) {
            Log.w(TAG, "direct activity start blocked (" + t.getMessage() + ") - full screen intent will handle it");
        }
    }

    // ------------------------------------------------------------------
    // الخدمة الأمامية + الإشعار المثبت
    // ------------------------------------------------------------------

    private void ensureForeground() {
        if (foregroundStarted) return;
        Notification n = buildGuardNotification(AlarmStore.load(this), System.currentTimeMillis());
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                try {
                    startForeground(
                        GUARD_NOTIFICATION_ID,
                        n,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED
                    );
                    foregroundStarted = true;
                    return;
                } catch (Throwable t) {
                    Log.w(TAG, "systemExempted FGS failed: " + t.getMessage());
                }
            }
            startForeground(GUARD_NOTIFICATION_ID, n);
            foregroundStarted = true;
        } catch (Throwable t) {
            Log.e(TAG, "startForeground failed: " + t.getMessage());
        }
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || nm == null) return;
        try {
            NotificationChannel guard =
                new NotificationChannel(
                    CHANNEL_GUARD,
                    "حارس المنبه / Alarm guard",
                    NotificationManager.IMPORTANCE_LOW
                );
            guard.setDescription(
                "إشعار مثبت يُظهر أن منبه الفجر يعمل والموعد القادم - لا يمكن إزالته"
            );
            guard.setSound(null, null);
            guard.enableVibration(false);
            guard.enableLights(true);
            guard.setLightColor(0xFF10B981);
            guard.setShowBadge(false);
            guard.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(guard);

            NotificationChannel alarm =
                new NotificationChannel(
                    CHANNEL_ALARM,
                    "رنين الفجر / Fajr alarm",
                    NotificationManager.IMPORTANCE_HIGH
                );
            alarm.setDescription("إشعار الرنين بملء الشاشة - يوقظك حتى لو الهاتف صامت");
            // الصوت يأتي من AlarmRinger (أقوى وأدق من صوت القناة)
            alarm.setSound(null, null);
            alarm.enableVibration(true);
            alarm.setVibrationPattern(new long[] { 0, 900, 400, 900, 400, 1600 });
            alarm.enableLights(true);
            alarm.setLightColor(0xFFEF4444);
            alarm.setShowBadge(true);
            try {
                alarm.setBypassDnd(true);
            } catch (Throwable ignored) {
                // يحتاج إذن ACCESS_NOTIFICATION_POLICY - غير قاتل
            }
            alarm.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(alarm);
        } catch (Throwable t) {
            Log.w(TAG, "channel creation failed: " + t.getMessage());
        }
    }

    /** الإشعار المثبت: حالة الحارس + الموعد القادم */
    private void postGuardNotification(AlarmStore.Config cfg, long now) {
        if (nm == null) return;
        try {
            nm.notify(GUARD_NOTIFICATION_ID, buildGuardNotification(cfg, now));
        } catch (Throwable t) {
            Log.w(TAG, "guard notification failed: " + t.getMessage());
        }
    }

    private void postRingNotification(AlarmStore.Config cfg, long now) {
        if (nm == null) return;
        try {
            nm.notify(RING_NOTIFICATION_ID, buildRingNotification(cfg, now));
        } catch (Throwable t) {
            Log.w(TAG, "ring notification failed: " + t.getMessage());
        }
    }

    private Notification buildGuardNotification(AlarmStore.Config cfg, long now) {
        long nextFire = AlarmScheduler.computeNextFire(cfg, now);
        boolean ringing = ringer != null && ringer.isRunning();
        boolean exact = AlarmScheduler.canScheduleExact(this);

        String title = ringing ? AlarmTexts.ringTitle(cfg) : AlarmTexts.guardTitle(cfg);
        String body;
        if (ringing) {
            long started = AlarmStore.ringStartedAt(this);
            body = AlarmTexts.ringingSub(cfg, started > 0L ? started : now, now);
        } else {
            body = AlarmTexts.guardBody(cfg, nextFire, now);
        }
        String sub = AlarmTexts.guardSub(cfg, exact);

        Notification.Builder b = baseBuilder(CHANNEL_GUARD);
        b.setContentTitle(title)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body + "\n" + sub))
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setPriority(Notification.PRIORITY_LOW)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setShowWhen(false)
            .setContentIntent(AlarmScheduler.openAppPendingIntent(this))
            .setDeleteIntent(deletePendingIntent());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        }
        // FLAG_NO_CLEAR: لا يُزال بـ «مسح الكل»
        Notification n = b.build();
        n.flags |= Notification.FLAG_NO_CLEAR | Notification.FLAG_ONGOING_EVENT;
        return n;
    }

    private Notification buildRingNotification(AlarmStore.Config cfg, long now) {
        Notification.Builder b = baseBuilder(CHANNEL_ALARM);
        b.setContentTitle(AlarmTexts.ringTitle(cfg))
            .setContentText(AlarmTexts.ringBody(cfg))
            .setStyle(
                new Notification.BigTextStyle()
                    .bigText(
                        AlarmTexts.ringBody(cfg)
                            + "\n"
                            + AlarmTexts.ringingSub(cfg, AlarmStore.ringStartedAt(this) > 0L
                                    ? AlarmStore.ringStartedAt(this)
                                    : now, now)
                    )
            )
            .setOngoing(true)
            .setAutoCancel(false)
            .setPriority(Notification.PRIORITY_MAX)
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setWhen(now)
            .setShowWhen(true)
            .setContentIntent(AlarmScheduler.openAppPendingIntent(this))
            .setFullScreenIntent(AlarmScheduler.openAppPendingIntent(this), true)
            .addAction(0, AlarmTexts.openAppAction(cfg), AlarmScheduler.openAppPendingIntent(this));
        Notification n = b.build();
        n.flags |= Notification.FLAG_NO_CLEAR | Notification.FLAG_ONGOING_EVENT;
        return n;
    }

    private Notification.Builder baseBuilder(String channelId) {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(this, channelId);
        } else {
            b = new Notification.Builder(this);
        }
        b.setSmallIcon(R.mipmap.ic_launcher);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            b.setColor(0xFF10B981);
        }
        return b;
    }

    /** لو أزال المستخدم الإشعار (أندرويد 14+) يعود فوراً */
    private PendingIntent deletePendingIntent() {
        Intent i = new Intent(this, AlarmReceiver.class);
        i.setAction(AlarmReceiver.ACTION_RESTORE_NOTIFICATION);
        i.setPackage(getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(this, REQ_DELETE, i, flags);
    }

    // ------------------------------------------------------------------
    // الإيقاف
    // ------------------------------------------------------------------

    private void stopEverything() {
        Log.i(TAG, "stopping guard service");
        if (ringer != null) ringer.stop();
        if (handler != null) handler.removeCallbacks(tick);
        try {
            if (nm != null) {
                nm.cancel(RING_NOTIFICATION_ID);
                nm.cancel(GUARD_NOTIFICATION_ID);
            }
        } catch (Throwable ignored) {
            // لا شيء
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(Service.STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Throwable t) {
            try {
                stopForeground(true);
            } catch (Throwable ignored) {
                // لا شيء
            }
        }
        foregroundStarted = false;
        stopSelf();
    }

    /** إيقاف الرنين من أي مكان في التطبيق */
    public static void requestStopRinging(Context ctx) {
        Intent i = new Intent(ctx, AlarmGuardService.class);
        i.setAction(ACTION_STOP_RING);
        try {
            ctx.startService(i);
        } catch (Throwable t) {
            AlarmScheduler.startGuardService(ctx, ACTION_STOP_RING);
        }
    }
}
