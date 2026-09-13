package com.hatsally.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;

/**
 * خدمة رنين منبه الفجر 🚨
 * ---------------------------------------------------------------
 * خدمة أمامية (Foreground Service) على مستوى النظام - هذه هي
 * الضمانة أن "التطبيق يظل يعمل حتى بعد حذف إشعاره":
 *
 *  - إشعار مستمر (ongoing) لا يمكن سحبه/حذفه من شريط الإشعارات
 *  - نية كاملة الشاشة (Full-Screen Intent) تفتح التطبيق فوق
 *    شاشة القفل مع إيقاظ الشاشة (showWhenLocked + turnScreenOn)
 *  - صوت منبه متكرر على قناة الـ ALARM بأقصى مستوى + اهتزاز
 *  - START_STICKY: إن أُغلق النظام عن الخدمة يعيد تشغيلها
 *
 * الخدمة تتوقف فقط عندما يُكتمل التحقق بالتصوير (stopRinging)
 * أو عندما يُلغي المستخدم المنبه (cancel).
 */
public class HatAlarmService extends Service {
    public static final String EXTRA_RINGING = "hatsally_ringing";

    private static final String CHANNEL_ID = "hatsally_alarm";
    private static final int NOTIF_ID = 4001;
    private static final int REQUEST_CODE = 4002;

    /** هل الخدمة (الرنين النظامي) تعمل الآن؟ - لقراءة الحالة من JS */
    private static boolean running = false;

    private MediaPlayer player;
    private Vibrator vibrator;
    private int savedAlarmVolume = -1;
    private int savedMusicVolume = -1;

    public static boolean isRunning() {
        return running;
    }

    public static void start(Context ctx) {
        try {
            Intent i = new Intent(ctx, HatAlarmService.class);
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
            ctx.stopService(new Intent(ctx, HatAlarmService.class));
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
                        CHANNEL_ID, "منبه هتصلي", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("منبه الفجر - لا يتوقف إلا بالتصوير");
                ch.setSound(null, null); // الصوت عبر MediaPlayer مباشرة
                ch.enableVibration(false); // الاهتزاز عبر Vibrator مباشرة
                nm.createNotificationChannel(ch);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        running = true;
        maxVolume();
        startRinging();
        try {
            startForeground(NOTIF_ID, buildNotification());
        } catch (Exception ignored) {}
        return START_STICKY;
    }

    /** رفع صوت المنبه والموسيقى للأقصى (يُعاد ضبطه عند التوقف) */
    private void maxVolume() {
        try {
            AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
            if (am == null) return;
            if (savedAlarmVolume < 0) {
                savedAlarmVolume = am.getStreamVolume(AudioManager.STREAM_ALARM);
                savedMusicVolume = am.getStreamVolume(AudioManager.STREAM_MUSIC);
            }
            am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
            am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), 0);
        } catch (Exception ignored) {}
    }

    private void startRinging() {
        stopRingingMedia();
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (uri != null) {
                player = new MediaPlayer();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AudioAttributes attrs = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                    player.setAudioAttributes(attrs);
                } else {
                    // قديم: قناة الصوت المباشرة (أندرويد 7 و8)
                    player.setAudioStreamType(AudioManager.STREAM_ALARM);
                }
                player.setDataSource(this, uri);
                player.setLooping(true);
                player.setOnErrorListener((mp, what, extra) -> {
                    stopRingingMedia();
                    return true;
                });
                player.prepare();
                player.start();
            }
        } catch (Exception e) {
            player = null;
        }
        try {
            vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {1000, 500, 1000, 500, 2000};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception ignored) {}
    }

    private void stopRingingMedia() {
        try {
            if (player != null) {
                player.stop();
                player.release();
            }
        } catch (Exception ignored) {}
        player = null;
        try {
            if (vibrator != null) vibrator.cancel();
        } catch (Exception ignored) {}
        vibrator = null;
    }

    private Notification buildNotification() {
        String name = HatAlarmConfig.loadName(this);
        if (name == null || name.isEmpty()) name = "بطل الفجر";
        boolean ar = !"en".equals(HatAlarmConfig.loadLang(this));

        String title = ar ? "🚨 استيقظ يا " + name + "!" : "🚨 Wake up " + name + "!";
        String body = ar
                ? "حان وقت الفجر يا " + name + "! المنبه مستمر ولن يتوقف إلا بالتصوير 🔒"
                : "Fajr time " + name + "! The alarm continues - only photo verification stops it 🔒";

        // فتح التطبيق فوق شاشة القفل
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra(EXTRA_RINGING, true);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(this, REQUEST_CODE, open, flags);

        Notification.Builder b = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);

        Notification n = b
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setOngoing(true)                 // لا يمكن سحبه/حذفه
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setFullScreenIntent(pi, true)    // تفتح فوق شاشة القفل
                .setContentIntent(pi)
                .setSound(null)
                .setVibrate(null)
                .build();
        n.flags |= Notification.FLAG_FOREGROUND_SERVICE;
        return n;
    }

    @Override
    public void onDestroy() {
        stopRingingMedia();
        // إزالة الإشعار المستمر وحالة الأمامية (لا يُحذف تلقائياً عند التوقف داخل نفس العملية)
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
        // إرجاع الصوت للمستوى السابق
        try {
            AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
            if (am != null && savedAlarmVolume >= 0) {
                am.setStreamVolume(AudioManager.STREAM_ALARM, savedAlarmVolume, 0);
                am.setStreamVolume(AudioManager.STREAM_MUSIC, savedMusicVolume, 0);
            }
        } catch (Exception ignored) {}
        running = false;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
