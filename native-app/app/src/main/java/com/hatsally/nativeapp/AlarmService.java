package com.hatsally.nativeapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

/**
 * خدمة رنين منبه الفجر 🚨
 * ---------------------------------------------------------------
 * الضمانة أن "التطبيق يظل يعمل حتى بعد حذف إشعاره":
 * - إشعار مستمر (ongoing) لا يمكن سحبه/حذفه
 * - نية كاملة الشاشة (Full-Screen Intent) تفتح شاشة الرنين فوق القفل
 * - الصوت والاهتزاز يديوانهما شاشة الرنين (AlarmActivity)
 *   والخدمة تبقي الإشعار والحالة حية حتى اكتمال التحقق
 * - START_STICKY: يعيدها النظام إن أُغقلت
 */
public class AlarmService extends Service {
    public static final String EXTRA_RINGING = "hatsally_ringing";
    public static final String EXTRA_REASON = "reason";
    public static final String EXTRA_ALARM_ID = "alarm_id";

    private static final String CHANNEL_ID = "hatsally_alarm";
    private static final int NOTIF_ID = 4001;
    private static final int REQUEST_CODE = 4002;

    private static boolean running = false;
    private static int ringingAlarmId = 0;

    public static boolean isRunning() {
        return running;
    }

    /** معرّف المنبه الرنّان حالياً (0 = غير معروف) */
    public static int ringingId() {
        return ringingAlarmId;
    }

    public static void start(Context ctx) {
        try {
            Intent i = new Intent(ctx, AlarmService.class);
            i.putExtra(EXTRA_RINGING, true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(i);
            } else {
                ctx.startService(i);
            }
        } catch (Exception ignored) {}
    }

    public static void stop(Context ctx) {
        try {
            ctx.stopService(new Intent(ctx, AlarmService.class));
        } catch (Exception ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    private void createChannel() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, getString(R.string.alarm_channel), NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription(getString(R.string.alarm_channel_desc));
                ch.setSound(null, null);
                ch.enableVibration(false);
                nm.createChannel(ch);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            int id = intent.getIntExtra(EXTRA_ALARM_ID, 0);
            if (id > 0) ringingAlarmId = id;
        }
        running = true;
        try {
            startForeground(NOTIF_ID, buildNotification());
        } catch (Exception ignored) {}
        return START_STICKY;
    }

    private Notification buildNotification() {
        String name = AlarmPrefs.alarmName(this, ringingAlarmId);
        if (name == null || name.isEmpty()) {
            name = "ar".equals(AlarmPrefs.loadLang(this)) ? "بطل الفجر" : "Fajr Hero";
        }
        boolean ar = "ar".equals(AlarmPrefs.loadLang(this));
        String title = ar
                ? getString(R.string.notif_title_ar, name)
                : getString(R.string.notif_title_en, name);
        String body = ar
                ? getString(R.string.notif_body_ar)
                : getString(R.string.notif_body_en);

        Intent open = new Intent(this, AlarmActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra(EXTRA_REASON, "tap");
        int fFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            fFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(this, REQUEST_CODE, open, fFlags);

        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
        }

        Notification n = b
                .setSmallIcon(R.drawable.ic_stat_alarm)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setOngoing(true)
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setFullScreenIntent(pi, true)
                .setContentIntent(pi)
                .setSound(null)
                .setVibrate(null)
                .build();
        n.flags |= Notification.FLAG_FOREGROUND_SERVICE;
        return n;
    }

    @Override
    public void onDestroy() {
        running = false;
        ringingAlarmId = 0;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception ignored) {}
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(NOTIF_ID);
        } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
