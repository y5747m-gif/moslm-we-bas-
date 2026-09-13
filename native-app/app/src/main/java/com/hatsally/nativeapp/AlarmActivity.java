package com.hatsally.nativeapp;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * شاشة الرنين الكاملة 🚨
 * ---------------------------------------------------------------
 * تفتح فوق شاشة القفل (showWhenLocked + turnScreenOn).
 * - تصعيد تلقائي: نداء لطيف ← جرس مزعج (5د) ← كابوس (10د)
 * - صوت رجل يناديك باسمك (TTS)
 * - لا يمكن إغلاقها بالرجوع - فقط "أنا مستيقظ" (التصوير) أو غفوة واحدة
 * - الصوت مستمر حتى اكتمال التحقق
 */
public class AlarmActivity extends AppCompatActivity {
    public static final String EXTRA_DEMO = "demo";
    public static final String EXTRA_ALARM_ID = "alarm_id";

    private static final long ESCALATION_MS = 5 * 60 * 1000L;
    private static final long EXTREME_MS = 10 * 60 * 1000L;
    private static final long SNOOZE_MS = 5 * 60 * 1000L;

    private TextView titleText;
    private TextView timeLineText;
    private TextView stageText;
    private TextView elapsedText;
    private TextView lockBadge;
    private View wokeButton;
    private View snoozeButton;
    private TextView snoozeLabel;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private SoundEngine sound;
    private SpeechEngine speech;
    private boolean demo;
    private int alarmId = 0;
    private boolean verificationActive = false;
    private long ringingSince = 0;
    private int currentStage = SoundEngine.STAGE_GENTLE;

    // غفوة بالضغط المطول
    private boolean snoozing = false;
    private int snoozeProgress = 0;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (isFinishing()) return;
            onTick();
            handler.postDelayed(this, 1000);
        }
    };

    private final Runnable snoozeTick = new Runnable() {
        @Override
        public void run() {
            if (!snoozing) return;
            snoozeProgress += 10;
            snoozeLabel.setText(getString(R.string.snooze_progress, String.valueOf(snoozeProgress)));
            if (snoozeProgress >= 100) {
                snoozing = false;
                doSnooze();
            } else {
                handler.postDelayed(this, 100);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // شاشة كاملة فوق القفل
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                            | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.activity_alarm);

        demo = getIntent() != null && getIntent().getBooleanExtra(EXTRA_DEMO, false);

        alarmId = getIntent() != null ? getIntent().getIntExtra(EXTRA_ALARM_ID, 0) : 0;
        // لو فُتحت الشاشة من إشعار الخدمة بدون معرّف → نأخذ معرّف الرنين الحالي
        if (alarmId <= 0) alarmId = AlarmService.ringingId();

        titleText = (TextView) findViewById(R.id.alarm_title);
        timeLineText = (TextView) findViewById(R.id.alarm_time_line);
        stageText = (TextView) findViewById(R.id.alarm_stage);
        elapsedText = (TextView) findViewById(R.id.alarm_elapsed);
        lockBadge = findViewById(R.id.alarm_lock_badge);
        wokeButton = findViewById(R.id.btn_woke);
        snoozeButton = findViewById(R.id.btn_snooze);
        snoozeLabel = (TextView) findViewById(R.id.snooze_label);

        String name = AlarmPrefs.alarmName(this, alarmId);
        String lang = AlarmPrefs.loadLang(this);
        boolean ar = "ar".equals(lang);
        if (name == null || name.isEmpty()) name = ar ? "بطل الفجر" : "Fajr Hero";
        titleText.setText(ar
                ? getString(R.string.wake_title_ar, name)
                : getString(R.string.wake_title_en, name));
        String time = AlarmPrefs.alarmTime(this, alarmId);
        timeLineText.setText(getString(R.string.ring_time_line, time));

        sound = new SoundEngine(this);
        speech = new SpeechEngine(this);
        speech.setName(name);
        speech.setLang(lang);

        wokeButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                goToVerification();
            }
        });

        snoozeButton.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                startSnoozeHold();
                return true;
            }
        });
        snoozeButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startSnoozeHold();
            }
        });
    }

    @Override
    protected void onStart() {
        super.onStart();
        // الضمانة: لو أُوقفت الخدمة (قتلها النظام) تعاد - الرنين لا يتوقف
        if (!AlarmService.isRunning()) {
            if (!demo) AlarmService.start(this);
        }
        if (ringingSince == 0) {
            ringingSince = System.currentTimeMillis();
        }
        sound.maxVolume();
        handler.post(tick);
        applyStage(SoundEngine.STAGE_GENTLE);
    }

    @Override
    protected void onStop() {
        super.onStop();
        // الرنين النظامي يستمر حتى مع إخفاء الشاشة (الخدمة) -
        // نوقف صوت الـ UI فقط إن ذهب المستخدم للتحقق
        if (verificationActive) {
            sound.stopAll();
            speech.stopLoop();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacks(tick);
        handler.removeCallbacks(snoozeTick);
        sound.stopAll();
        speech.stopLoop();
        if (!verificationActive) {
            speech.shutdown();
        }
    }

    private void onTick() {
        long elapsed = System.currentTimeMillis() - ringingSince;
        SimpleDateFormat f = new SimpleDateFormat("mm:ss", Locale.US);
        elapsedText.setText(getString(R.string.ringing_since) + " " + f.format(new Date()));

        int stage;
        if (elapsed < ESCALATION_MS) stage = SoundEngine.STAGE_GENTLE;
        else if (elapsed < EXTREME_MS) stage = SoundEngine.STAGE_ANNOYING;
        else stage = SoundEngine.STAGE_EXTREME;
        applyStage(stage);
    }

    private void applyStage(int stage) {
        if (stage == currentStage) return;
        currentStage = stage;
        String lang = AlarmPrefs.loadLang(this);
        boolean ar = "ar".equals(lang);
        switch (stage) {
            case SoundEngine.STAGE_GENTLE:
                stageText.setText(ar ? getString(R.string.stage_gentle_ar) : getString(R.string.stage_gentle_en));
                stageText.setTextColor(getResources().getColor(R.color.stage_gentle));
                sound.setStage(SoundEngine.STAGE_GENTLE);
                speech.stopLoop();
                speech.startLoop("ring", null);
                break;
            case SoundEngine.STAGE_ANNOYING:
                stageText.setText(ar ? getString(R.string.stage_annoying_ar) : getString(R.string.stage_annoying_en));
                stageText.setTextColor(getResources().getColor(R.color.stage_annoying));
                sound.setStage(SoundEngine.STAGE_ANNOYING);
                speech.stopLoop();
                speech.startLoop("ring-annoying", null);
                break;
            case SoundEngine.STAGE_EXTREME:
                stageText.setText(ar ? getString(R.string.stage_extreme_ar) : getString(R.string.stage_extreme_en));
                stageText.setTextColor(getResources().getColor(R.color.stage_extreme));
                sound.setStage(SoundEngine.STAGE_EXTREME);
                speech.stopLoop();
                speech.startLoop("ring-extreme", null);
                break;
            default:
                break;
        }
    }

    private void goToVerification() {
        verificationActive = true;
        Intent i = new Intent(this, VerificationActivity.class);
        i.putExtra(AlarmActivity.EXTRA_DEMO, demo);
        i.putExtra(EXTRA_ALARM_ID, alarmId);
        startActivity(i);
        finish();
    }

    // ------------------------------------------------------------------
    // الغفوة: ضغط مطول 3 ثوانٍ - مرة واحدة فقط
    // ------------------------------------------------------------------
    private void startSnoozeHold() {
        if (snoozing) return;
        String today = AlarmPrefs.todayKey(Calendar.getInstance());
        if (!demo && alarmId > 0 && AlarmPrefs.getSnoozeKey(this, alarmId).equals(today)) {
            Toast.makeText(this, getString(R.string.snooze_used), Toast.LENGTH_LONG).show();
            vibrate(300);
            sound.setStage(SoundEngine.STAGE_EXTREME);
            return;
        }
        snoozing = true;
        snoozeProgress = 0;
        snoozeLabel.setText(getString(R.string.hold_snooze));
        handler.postDelayed(snoozeTick, 100);
    }

    private void doSnooze() {
        snoozing = false;
        String today = AlarmPrefs.todayKey(Calendar.getInstance());
        if (!demo) {
            if (alarmId > 0) {
                AlarmPrefs.setSnoozeKey(this, alarmId, today);
                AlarmScheduler.armSnooze(this, alarmId, System.currentTimeMillis() + SNOOZE_MS);
            }
            AlarmService.stop(this);
        }
        sound.stopAll();
        speech.stopLoop();
        Toast.makeText(this, getString(R.string.snooze_set), Toast.LENGTH_LONG).show();
        vibrate(200);
        finish();
    }

    private void vibrate(long ms) {
        try {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(ms);
                }
            }
        } catch (Exception ignored) {}
    }

    /** لا يمكن إغلاق الشاشة بالرجوع - فقط بالتحقق */
    @Override
    public void onBackPressed() {
        if (demo) {
            sound.stopAll();
            speech.shutdown();
            super.onBackPressed();
            return;
        }
        vibrate(300);
        Toast.makeText(this, getString(R.string.cannot_close), Toast.LENGTH_SHORT).show();
        speech.speakNow(AlarmPrefs.loadLang(this).equals("en")
                ? "Cannot close! Only photo verification stops it!"
                : "لا يمكن الإغلاق! لن يتوقف إلا بالتصوير!");
    }

}
