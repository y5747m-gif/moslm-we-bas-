package com.hatsally.app;

import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import java.util.Locale;

/**
 * الرنّان الأصلي 🔊 (صوت + اهتزاز + نداء بالاسم + إيقاظ الشاشة)
 * ------------------------------------------------------------------
 * يعمل من داخل الخدمة الأصلية، أي أن الرنين يحدث حتى لو كان الـ WebView
 * ميتاً أو التطبيق مغلقاً تماماً:
 *  - صوت المنبه الافتراضي للجهاز على قناة STREAM_ALARM بحلقة لا تنتهي
 *  - رفع صوت المنبه/الوسائط للأقصى ثم إعادته بعد الانتهاء
 *  - اهتزاز متكرر بنمط قوي
 *  - إيقاظ الشاشة وإضاءةها فوق شاشة القفل + منع النوم
 *  - نداء باسم المستخدم بصوت رجل عبر محرك TTS الخاص بالجهاز
 *  - تجاوز «عدم الإزعاج» لو منح المستخدم الإذن
 */
public final class AlarmRinger {

    public static final String TAG = "HatSallyRinger";

    /** كل 15 ثانية: إعادة تأمين القفل + نداء جديد (طوال الرنين) */
    private static final long LOOP_MS = 15000L;
    /** أقصى مدة للقفل الواحد (يُجدَّد داخل الحلقة) */
    private static final long SCREEN_LOCK_MS = 120000L;
    private static final long CPU_LOCK_MS = 60 * 60 * 1000L;

    private static final long[] VIBRATE_PATTERN = new long[] { 0, 1000, 450, 1000, 450, 1800 };

    private final Context ctx;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private MediaPlayer player;
    private Ringtone fallbackTone;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;
    private PowerManager.WakeLock screenLock;
    private PowerManager.WakeLock cpuLock;
    private Vibrator vibrator;

    private int savedAlarmVolume = -1;
    private int savedMusicVolume = -1;
    private int savedInterruptionFilter = -1;

    private volatile boolean running = false;
    private AlarmStore.Config cfg = new AlarmStore.Config();

    private final Runnable loop =
        new Runnable() {
            @Override
            public void run() {
                if (!running) return;
                keepAwake();
                speak();
                if (fallbackTone != null) playFallbackTone();
                handler.postDelayed(this, LOOP_MS);
            }
        };

    public AlarmRinger(Context ctx) {
        this.ctx = ctx.getApplicationContext();
    }

    public boolean isRunning() {
        return running;
    }

    // ------------------------------------------------------------------
    // البدء
    // ------------------------------------------------------------------

    public synchronized void start(AlarmStore.Config config) {
        if (config != null) this.cfg = config;
        if (running) {
            // استمرارية: جدّد النداء والقفل فقط
            handler.removeCallbacks(loop);
            handler.post(loop);
            return;
        }
        running = true;
        Log.i(TAG, "start ringing for " + (cfg.name == null ? "" : cfg.name));
        maxVolume();
        bypassDnd();
        startSound();
        startVibration();
        initTts();
        keepAwake();
        handler.removeCallbacks(loop);
        handler.postDelayed(loop, LOOP_MS);
    }

    public synchronized void stop() {
        if (!running && player == null && tts == null) return;
        running = false;
        Log.i(TAG, "stop ringing");
        handler.removeCallbacks(loop);

        if (player != null) {
            try {
                if (player.isPlaying()) player.stop();
            } catch (Throwable ignored) {
                // لا شيء
            }
            try {
                player.release();
            } catch (Throwable ignored) {
                // لا شيء
            }
            player = null;
        }
        if (fallbackTone != null) {
            try {
                fallbackTone.stop();
            } catch (Throwable ignored) {
                // لا شيء
            }
            fallbackTone = null;
        }
        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Throwable ignored) {
                // لا شيء
            }
        }
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Throwable ignored) {
                // لا شيء
            }
            tts = null;
            ttsReady = false;
        }
        releaseLocks();
        restoreVolume();
        restoreDnd();
    }

    // ------------------------------------------------------------------
    // الصوت
    // ------------------------------------------------------------------

    private void startSound() {
        Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        if (uri != null) {
            try {
                MediaPlayer mp = new MediaPlayer();
                mp.setDataSource(ctx, uri);
                mp.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                );
                mp.setLooping(true);
                mp.prepare();
                mp.start();
                player = mp;
                Log.i(TAG, "alarm sound started: " + uri);
                return;
            } catch (Throwable t) {
                Log.w(TAG, "MediaPlayer failed (" + t.getMessage() + ") - fallback ringtone");
                if (player != null) {
                    try {
                        player.release();
                    } catch (Throwable ignored) {
                        // لا شيء
                    }
                    player = null;
                }
            }
            try {
                fallbackTone = RingtoneManager.getRingtone(ctx, uri);
                if (fallbackTone != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        fallbackTone.setAudioAttributes(
                            new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_ALARM)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .build()
                        );
                    }
                    playFallbackTone();
                }
            } catch (Throwable t) {
                Log.w(TAG, "fallback ringtone failed: " + t.getMessage());
            }
        }
        if (player == null && fallbackTone == null) startToneGenerator();
    }

    private android.media.ToneGenerator toneGen;

    /** آخر حل: نغمات نظام على قناة المنبه (تعمل حتى بدون أي نغمة مثبتة) */
    private void startToneGenerator() {
        try {
            toneGen = new android.media.ToneGenerator(AudioManager.STREAM_ALARM, 100);
            toneGen.startTone(android.media.ToneGenerator.TONE_CDMA_EMERGENCY_RINGBACK, 3000);
            Log.i(TAG, "ToneGenerator alarm started");
        } catch (Throwable t) {
            Log.e(TAG, "no sound source available: " + t.getMessage());
        }
    }

    private void playFallbackTone() {
        try {
            if (fallbackTone != null && !fallbackTone.isPlaying()) fallbackTone.play();
        } catch (Throwable ignored) {
            // لا شيء
        }
        try {
            if (toneGen != null && player == null && fallbackTone == null) {
                toneGen.startTone(android.media.ToneGenerator.TONE_CDMA_EMERGENCY_RINGBACK, 3000);
            }
        } catch (Throwable ignored) {
            // لا شيء
        }
    }

    private void maxVolume() {
        try {
            AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return;
            if (savedAlarmVolume < 0) {
                savedAlarmVolume = am.getStreamVolume(AudioManager.STREAM_ALARM);
                savedMusicVolume = am.getStreamVolume(AudioManager.STREAM_MUSIC);
            }
            am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
            am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), 0);
        } catch (Throwable t) {
            Log.w(TAG, "maxVolume failed: " + t.getMessage());
        }
    }

    private void restoreVolume() {
        try {
            AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            if (am != null && savedAlarmVolume >= 0) {
                am.setStreamVolume(AudioManager.STREAM_ALARM, savedAlarmVolume, 0);
                if (savedMusicVolume >= 0) am.setStreamVolume(AudioManager.STREAM_MUSIC, savedMusicVolume, 0);
            }
        } catch (Throwable ignored) {
            // لا شيء
        }
        savedAlarmVolume = -1;
        savedMusicVolume = -1;
        if (toneGen != null) {
            try {
                toneGen.release();
            } catch (Throwable ignored) {
                // لا شيء
            }
            toneGen = null;
        }
    }

    // ------------------------------------------------------------------
    // الاهتزاز
    // ------------------------------------------------------------------

    private void startVibration() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) vibrator = vm.getDefaultVibrator();
            }
            if (vibrator == null) vibrator = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator == null || !vibrator.hasVibrator()) return;

            AudioAttributes attrs =
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // repeat = 0 → اهتزاز متواصل حتى الإيقاف
                vibrator.vibrate(VibrationEffect.createWaveform(VIBRATE_PATTERN, 0), attrs);
            } else {
                vibrator.vibrate(VIBRATE_PATTERN, 0);
            }
        } catch (Throwable t) {
            Log.w(TAG, "vibration failed: " + t.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // إيقاظ الشاشة ومنع النوم
    // ------------------------------------------------------------------

    @SuppressWarnings("deprecation")
    private void keepAwake() {
        try {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (pm == null) return;
            if (screenLock == null) {
                screenLock =
                    pm.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK
                            | PowerManager.ACQUIRE_CAUSES_WAKEUP
                            | PowerManager.ON_AFTER_RELEASE,
                        "HatSally::AlarmScreen"
                    );
                screenLock.setReferenceCounted(false);
            }
            if (!screenLock.isHeld()) screenLock.acquire(SCREEN_LOCK_MS);

            if (cpuLock == null) {
                cpuLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HatSally::AlarmCpu");
                cpuLock.setReferenceCounted(false);
            }
            if (!cpuLock.isHeld()) cpuLock.acquire(CPU_LOCK_MS);
        } catch (Throwable t) {
            Log.w(TAG, "wake lock failed: " + t.getMessage());
        }
    }

    private void releaseLocks() {
        try {
            if (screenLock != null && screenLock.isHeld()) screenLock.release();
        } catch (Throwable ignored) {
            // لا شيء
        }
        try {
            if (cpuLock != null && cpuLock.isHeld()) cpuLock.release();
        } catch (Throwable ignored) {
            // لا شيء
        }
    }

    // ------------------------------------------------------------------
    // النداء بالاسم (TTS)
    // ------------------------------------------------------------------

    private void initTts() {
        try {
            tts =
                new TextToSpeech(
                    ctx,
                    new TextToSpeech.OnInitListener() {
                        @Override
                        public void onInit(int status) {
                            if (status != TextToSpeech.SUCCESS || tts == null) return;
                            try {
                                Locale loc =
                                    AlarmTexts.isAr(cfg.lang) ? new Locale("ar", "SA") : Locale.US;
                                tts.setLanguage(loc);
                                tts.setPitch(0.7f);
                                tts.setSpeechRate(0.92f);
                                ttsReady = true;
                                speak();
                            } catch (Throwable t) {
                                Log.w(TAG, "tts init failed: " + t.getMessage());
                            }
                        }
                    }
                );
        } catch (Throwable t) {
            Log.w(TAG, "tts unavailable: " + t.getMessage());
        }
    }

    private void speak() {
        if (!ttsReady || tts == null || !running) return;
        try {
            String text = AlarmTexts.ttsWake(cfg);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "hatsally-wake");
            } else {
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null);
            }
        } catch (Throwable t) {
            Log.w(TAG, "tts speak failed: " + t.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // تجاوز عدم الإزعاج
    // ------------------------------------------------------------------

    private void bypassDnd() {
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (!nm.isNotificationPolicyAccessGranted()) return;
            if (savedInterruptionFilter < 0) savedInterruptionFilter = nm.getCurrentInterruptionFilter();
            if (savedInterruptionFilter != NotificationManager.INTERRUPTION_FILTER_ALL) {
                nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL);
                Log.i(TAG, "DND bypassed for the alarm");
            }
        } catch (Throwable t) {
            Log.w(TAG, "dnd bypass failed: " + t.getMessage());
        }
    }

    private void restoreDnd() {
        try {
            if (savedInterruptionFilter < 0) return;
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.isNotificationPolicyAccessGranted()) {
                nm.setInterruptionFilter(savedInterruptionFilter);
            }
        } catch (Throwable ignored) {
            // لا شيء
        }
        savedInterruptionFilter = -1;
    }
}
