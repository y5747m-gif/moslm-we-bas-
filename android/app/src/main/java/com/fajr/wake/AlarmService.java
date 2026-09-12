package com.fajr.wake;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;

/**
 * مشغّل المنبه: يشغّل صوت الأذان/النغمة أو الاهتزاز بشكل متكرر
 * حتى يوقفه المستخدم بنفسه من شاشة المنبه.
 */
public class AlarmService extends Service {

    private MediaPlayer player;
    private Vibrator vibrator;
    public static volatile boolean playing = false;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        boolean test = intent != null && intent.getBooleanExtra("test", false);
        boolean backup = intent != null && AlarmTools.ACTION_BACKUP.equals(intent.getAction());
        startForeground(2002, buildNotif(test, backup));
        startSound();
        return START_NOT_STICKY;
    }

    private Notification buildNotif(boolean test, boolean backup) {
        AlarmTools.ensureChannel(this);
        Intent open = new Intent(this, AlarmActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(this, 3003, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        int title = test ? R.string.btn_test_sound
                : backup ? R.string.notif_backup_title : R.string.notif_title;
        return new Notification.Builder(this, AlarmTools.CHANNEL)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(getString(title))
                .setContentText(getString(R.string.notif_text))
                .setCategory(Notification.CATEGORY_ALARM)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }

    private void startSound() {
        stopSound();
        Prefs p = Prefs.get(this);
        String s = p.soundUri();

        if ("none".equals(s)) {
            startVibrate();
            return;
        }

        Uri uri = null;
        if (s == null || s.isEmpty()) {
            uri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM);
        } else {
            try {
                uri = Uri.parse(s);
            } catch (Exception ignored) {
            }
        }
        if (uri == null) {
            uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        }
        if (startPlayer(uri)) return;

        // خطة بديلة: النغمة الافتراضية للمنبه
        Uri fb = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM);
        if (fb == null) fb = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (fb != null && startPlayer(fb)) return;

        startVibrate(); // آخر خطة: اهتزاز لا يتوقف
    }

    private boolean startPlayer(Uri uri) {
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            player.setDataSource(this, uri);
            player.setLooping(true);
            player.prepare();
            player.start();
            playing = true;
            return true;
        } catch (Throwable t) {
            try {
                if (player != null) player.release();
            } catch (Throwable ignored) {
            }
            player = null;
            return false;
        }
    }

    private void startVibrate() {
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null) {
                vibrator.vibrate(VibrationEffect.createWaveform(
                        new long[]{0, 800, 400, 800}, 0)); // تكرار لا نهائي
            }
        } catch (Throwable ignored) {
        }
    }

    private void stopSound() {
        playing = false;
        if (player != null) {
            try {
                player.stop();
                player.release();
            } catch (Throwable ignored) {
            }
            player = null;
        }
        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Throwable ignored) {
            }
            vibrator = null;
        }
    }

    public static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, AlarmService.class));
    }

    @Override
    public void onDestroy() {
        stopSound();
        super.onDestroy();
    }
}
