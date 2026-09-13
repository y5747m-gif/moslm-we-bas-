package com.hatsally.nativeapp;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;

/**
 * محرك صوت الرنين 🔊
 * ---------------------------------------------------------------
 * - المرحلة اللطيفة: نغمة هادئة متكررة (AudioTrack - بدون ملفات)
 * - المراحل المزعجة/الكابوس: نغمة المنبه الافتراضية بأقصى مستوى
 * - اهتزاز بنمط متصاعد
 * - رفع صوت المنبه/الموسيقى للأقصى ثم إرجاعه عند التوقف
 * يعمل على كل الأجهزة بدون إنترنت وبدون ملفات صوتية.
 */
public class SoundEngine {
    public static final int STAGE_GENTLE = 1;
    public static final int STAGE_ANNOYING = 2;
    public static final int STAGE_EXTREME = 3;

    private final Context appCtx;
    private AudioTrack beepTrack;
    private MediaPlayer alarmPlayer;
    private Vibrator vibrator;
    private int savedAlarmVolume = -1;
    private int savedMusicVolume = -1;
    private int currentStage = 0;

    public SoundEngine(Context ctx) {
        this.appCtx = ctx.getApplicationContext();
    }

    /** رفع الصوت للأقصى (يُحفظ السابق للإرجاع) */
    public void maxVolume() {
        try {
            AudioManager am = (AudioManager) appCtx.getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return;
            if (savedAlarmVolume < 0) {
                savedAlarmVolume = am.getStreamVolume(AudioManager.STREAM_ALARM);
                savedMusicVolume = am.getStreamVolume(AudioManager.STREAM_MUSIC);
            }
            am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
            am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), 0);
        } catch (Exception ignored) {}
    }

    public void restoreVolume() {
        try {
            AudioManager am = (AudioManager) appCtx.getSystemService(Context.AUDIO_SERVICE);
            if (am != null && savedAlarmVolume >= 0) {
                am.setStreamVolume(AudioManager.STREAM_ALARM, savedAlarmVolume, 0);
                am.setStreamVolume(AudioManager.STREAM_MUSIC, savedMusicVolume, 0);
            }
        } catch (Exception ignored) {}
        savedAlarmVolume = -1;
    }

    /** بدء/تغيير مرحلة الرنين (1 لطيف، 2 مزعج، 3 كابوس) */
    public synchronized void setStage(int stage) {
        if (stage == currentStage) return;
        currentStage = stage;
        stopMedia();
        switch (stage) {
            case STAGE_GENTLE:
                startGentleBeep();
                vibrateLoop(new long[]{600, 400, 600, 400});
                break;
            case STAGE_ANNOYING:
                startAlarmTone(900);
                vibrateLoop(new long[]{1000, 500, 1000, 500});
                break;
            case STAGE_EXTREME:
                startAlarmTone(350);
                vibrateLoop(new long[]{2000, 200, 2000, 200, 2000, 200});
                break;
            default:
                break;
        }
    }

    /** نغمة هادئة: 660Hz / 520Hz متناوبة - تُبنى برمجياً (بدون ملفات) */
    private void startGentleBeep() {
        try {
            int sampleRate = 22050;
            int samplesPerSec = sampleRate;
            // نمط: 450ms صوت (660 ثم 520) + 2100ms صمت
            int beepMs = 450;
            int gapMs = 2100;
            int totalMs = beepMs + gapMs;
            int frameCount = samplesPerSec * totalMs / 1000;
            short[] data = new short[frameCount];
            int beepLen = samplesPerSec * beepMs / 1000;
            int half = beepLen / 2;
            for (int i = 0; i < beepLen; i++) {
                double t = (double) i / sampleRate;
                double f = i < half ? 660.0 : 520.0;
                double env = Math.min(1.0, Math.min(i, beepLen - i) / 800.0); // ناعم
                data[i] = (short) (Math.sin(2 * Math.PI * f * t) * 9000 * env);
            }
            AudioTrack track;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                track = new AudioTrack.Builder()
                        .setAudioAttributes(attrs)
                        .setAudioFormat(new AudioFormat.Builder()
                                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                                .setSampleRate(sampleRate)
                                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                                .build())
                        .setBufferSizeInBytes(data.length * 2)
                        .setTransferMode(AudioTrack.MODE_STREAM)
                        .build();
            } else {
                track = new AudioTrack(AudioManager.STREAM_ALARM, sampleRate,
                        AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT,
                        data.length * 2, AudioTrack.MODE_STREAM);
            }
            track.play();
            track.write(data, 0, data.length);
            // إعادة الكتابة الدورية في نفس النمط
            beepTrack = track;
            Thread t = new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        while (beepTrack != null && beepTrack.getPlayState() == AudioTrack.PLAYSTATE_PLAYING) {
                            Thread.sleep(totalMs);
                            if (beepTrack == null) break;
                            beepTrack.write(data, 0, data.length);
                        }
                    } catch (InterruptedException ignored) {
                    } catch (Exception ignored) {}
                }
            });
            t.setDaemon(true);
            t.start();
        } catch (Exception e) {
            beepTrack = null;
        }
    }

    /** نغمة المنبه الافتراضية (أو الرنة) بتكرار - دورة اهتزاز سريعة حسب الفترة */
    private void startAlarmTone(int vibrationPeriodMs) {
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (uri != null) {
                alarmPlayer = new MediaPlayer();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AudioAttributes attrs = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                    alarmPlayer.setAudioAttributes(attrs);
                } else {
                    alarmPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
                }
                alarmPlayer.setDataSource(appCtx, uri);
                alarmPlayer.setLooping(true);
                alarmPlayer.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                    @Override
                    public boolean onError(MediaPlayer mp, int what, int extra) {
                        stopMedia();
                        return true;
                    }
                });
                alarmPlayer.prepare();
                alarmPlayer.start();
            }
        } catch (Exception e) {
            alarmPlayer = null;
        }
    }

    private void vibrateLoop(long[] pattern) {
        try {
            vibrator = (Vibrator) appCtx.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator == null || !vibrator.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                vibrator.vibrate(pattern, 0);
            }
        } catch (Exception ignored) {}
    }

    private void stopMedia() {
        try {
            if (beepTrack != null) {
                beepTrack.stop();
                beepTrack.release();
            }
        } catch (Exception ignored) {}
        beepTrack = null;
        try {
            if (alarmPlayer != null) {
                alarmPlayer.stop();
                alarmPlayer.release();
            }
        } catch (Exception ignored) {}
        alarmPlayer = null;
        try {
            if (vibrator != null) vibrator.cancel();
        } catch (Exception ignored) {}
    }

    /** إيقاف كل شيء + إرجاع الصوت */
    public synchronized void stopAll() {
        currentStage = 0;
        stopMedia();
        restoreVolume();
    }
}
