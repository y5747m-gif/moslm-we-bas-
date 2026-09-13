package com.hatsally.nativeapp;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import java.util.Locale;

/**
 * النطق الصوتي الأصلي - صوت رجل عميق يناديك باسمك 🎙
 * ---------------------------------------------------------------
 * يستخدم محرك تحويل النص إلى كلام (TTS) على الجهاز:
 * - لغة عربية إن توفرت (ar) وإلا اللغة الافتراضية
 * - نبرة منخفضة (pitch 0.55) وسرعة هادئة لصوت رجولي عميق
 * - حلقات نداء أثناء الرنين/التصعيد/التحقق
 * يعمل بدون إنترنت.
 */
public class SpeechEngine {
    private TextToSpeech tts;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable loopRunnable;
    private String currentName = "";
    private String currentLang = "ar";
    private boolean urgent = false;
    private int loopMs = 8000;
    private boolean speaking = false;

    public SpeechEngine(Context ctx) {
        try {
            tts = new TextToSpeech(ctx.getApplicationContext(), new TextToSpeech.OnInitListener() {
                @Override
                public void onInit(int status) {
                    if (status == TextToSpeech.SUCCESS && tts != null) {
                        Locale ar = Locale.forLanguageTag("ar");
                        int r = tts.isLanguageAvailable(ar);
                        if (r == TextToSpeech.LANG_AVAILABLE || r == TextToSpeech.LANG_COUNTRY_AVAILABLE) {
                            tts.setLanguage(ar);
                        }
                        tts.setPitch(0.55f); // نبرة عميقة (رجل)
                        tts.setSpeechRate(0.85f);
                        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                            @Override
                            public void onStart(String utteranceId) {
                                speaking = true;
                            }

                            @Override
                            public void onDone(String utteranceId) {
                                speaking = false;
                            }

                            @Override
                            public void onError(String utteranceId) {
                                speaking = false;
                            }
                        });
                    }
                }
            });
        } catch (Exception ignored) {}
    }

    /** نداء استيقاظ (لطيف أو عاجل) حسب المرحلة */
    public String wakePhrase(boolean isUrgent) {
        String n = currentName;
        if (currentLang.equals("en")) {
            return isUrgent
                    ? "Wake up " + n + "! Wake up now " + n + "! Prayer time is here! Get up " + n + "!"
                    : "Wake up " + n + "... it is Fajr time " + n + "... get up for prayer " + n + "...";
        }
        return isUrgent
                ? "استيقظ يا " + n + "! استيقظ حالاً يا " + n + "! وقت الصلاة قد حان! قم يا " + n + "!"
                : "استيقظ يا " + n + "... حان وقت الفجر يا " + n + "... قم للصلاة يا " + n + "...";
    }

    /** نداء المهمة أثناء التحقق */
    public String verifyPhrase(String taskId) {
        String n = currentName;
        if (currentLang.equals("en")) {
            if (taskId.equals("water")) return n + " photograph the water tap now to prove wudu! Come on " + n + "!";
            if (taskId.equals("prayer")) return "Good " + n + "! Now photograph the prayer mat " + n + "! Excellent!";
            return "Excellent " + n + "! Now photograph your face with your eyes open " + n + "!";
        }
        if (taskId.equals("water")) return "يا " + n + " صور صنبور المياه الآن لإثبات الوضوء! هيا يا " + n + "!";
        if (taskId.equals("prayer")) return "أحسنت يا " + n + "! الآن صور المصلاة يا " + n + "! ممتاز يا بطل!";
        return "ممتاز يا " + n + "! الآن صور وجهك وعيناك مفتوحتان يا " + n + "!";
    }

    public String successPhrase() {
        String n = currentName;
        if (currentLang.equals("en")) {
            return "May Allah accept " + n + "! Well done on waking and wudu!";
        }
        return "تقبل الله يا " + n + "! أحسنت الوضوء والاستيقاظ!";
    }

    public void setName(String name) {
        currentName = name == null || name.isEmpty() ? (currentLang.equals("en") ? "Hero" : "بطل الفجر") : name;
    }

    public void setLang(String lang) {
        currentLang = "en".equals(lang) ? "en" : "ar";
    }

    /** بدء حلقة النداء: mode = "ring" (يبدأ لطيفاً) | "verify" (حسب المهمة) */
    public synchronized void startLoop(final String mode, final String verifyTaskId) {
        stopLoop();
        urgent = mode.equals("ring-annoying") || mode.equals("ring-extreme");
        loopMs = "verify".equals(mode) ? 10000 : 8000;
        loopRunnable = new Runnable() {
            @Override
            public void run() {
                String text;
                if ("verify".equals(mode)) {
                    text = verifyPhrase(verifyTaskId);
                } else {
                    text = wakePhrase(urgent);
                }
                speakNow(text);
            }
        };
        // نداء فوري ثم كل loopMs
        final Runnable first = new Runnable() {
            @Override
            public void run() {
                if (loopRunnable == null) return;
                loopRunnable.run();
                handler.postDelayed(this, loopMs);
            }
        };
        handler.postDelayed(first, 600);
    }

    public synchronized void stopLoop() {
        if (loopRunnable != null) {
            handler.removeCallbacks(loopRunnable);
        }
        loopRunnable = null;
    }

    /** نطق فوري (يلغي السابق) */
    public synchronized void speakNow(final String text) {
        if (tts == null) return;
        handler.post(new Runnable() {
            @Override
            public void run() {
                try {
                    tts.stop();
                    tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "hatsally");
                } catch (Exception ignored) {}
            }
        });
    }

    public boolean isAvailable() {
        return tts != null;
    }

    public void shutdown() {
        stopLoop();
        try {
            if (tts != null) {
                tts.stop();
                tts.shutdown();
            }
        } catch (Exception ignored) {}
        tts = null;
    }
}
