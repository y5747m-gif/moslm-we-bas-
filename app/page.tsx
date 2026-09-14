"use client";

/**
 * هتصلي يعني هتصلي 🕌 - التطبيق
 * ================================================================
 * تطبيق مستقل بهويته الخاصة (شريط علوي + تبويبات سفلية + ألواح سفلية)
 * وليس صفحة ويب طويلة، وبنفس كل المميزات المطلوبة:
 *  - منبهات متعددة بلا حد، كل منبه يرن في نفس موعده **كل يوم**
 *  - نداء باسمك بصوت رجل + تصعيد تدريجي + تحقق بالتصوير (ذكاء اصطناعي)
 *  - أذونات يمنحها المستخدم + تنبيه أصلي دائم + عمل بدون إنترنت
 *  - تثبيت كتطبيق (PWA/APK) + لغتان + مظهران
 *  - اسم المطور في آخر التطبيق: Yaseen amr abd el rahem
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
  Bell,
  BellRing,
  Camera,
  Check,
  ChevronLeft,
  Download,
  Droplets,
  Eye,
  Globe,
  Heart,
  Hourglass,
  Info,
  Loader2,
  Lock,
  Moon,
  Play,
  Repeat,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Timer,
  User,
  Volume2,
  VolumeX,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import QRCode from "react-qr-code";

import { verifyCapture, warmUpVerification, type VerifyTask } from "../lib/verify";
import type { VisionCheck } from "../lib/vision";
import { getTodayKey } from "../lib/schedule";
import { checkCritical, enforceRinging, openNativeAppOr, relaxAfterRinging } from "../lib/permissions";
import {
  APK_RELEASE_URL,
  cancelNativeAlarm,
  downloadApk,
  getApkInfo,
  guardBackButtonWhileRinging,
  isAndroidDevice,
  isIosDevice,
  isNativeApp as checkNativeApp,
  nativeSpeak,
  notifyNative,
  onNativeAlarmTap,
  requestNativePermissions,
  scheduleNativeAlarms,
  stopNativeSpeech,
  triggerBlobDownload,
  type ApkInfo,
} from "../lib/native";
import {
  MAX_ALARMS,
  armAlarm,
  autoExpire,
  countdownText,
  createAlarm,
  dayWord,
  defaultAlarm,
  dueAlarms,
  durationSummary,
  isAlarmExpired,
  isDaily,
  loadAlarms,
  markFired,
  missedAlarms,
  nextRingAmong,
  nextRingOf,
  passedTodayBeyondGrace,
  patchAlarm,
  removeAlarm,
  repeatSummary,
  saveAlarms,
  upsertAlarm,
  type AlarmDraft,
  type AlarmRecord,
} from "../lib/alarms";
import { DEVELOPER_NAME, translations, type Dict, type Language, type Theme } from "../lib/i18n";
import { haptic, tokens } from "../lib/ui";

import PermissionsPanel from "./components/PermissionsPanel";
import { AppBar, Fab, StatusStrip, TabBar, type TabId } from "./components/AppChrome";
import AlarmCard from "./components/AlarmCard";
import AlarmSheet from "./components/AlarmSheet";
import { Button, Card, Chip, Progress, Row, SectionTitle, Sheet, Switch } from "./components/ui";

type AlarmStage = "idle" | "ringing" | "annoying" | "extreme" | "verification" | "completed";
type VerificationId = "water" | "prayer" | "face";

interface VerificationTask {
  id: VerificationId;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  completed: boolean;
  image: string | null;
}

const APP_VERSION = "6.0.0-multi-alarm";

export default function Page() {
  /* ───────────── الهوية: اللغة والمظهر والتبويب ───────────── */
  const [language, setLanguage] = useState<Language>("ar");
  const [theme, setTheme] = useState<Theme>("dark");
  const [tab, setTab] = useState<TabId>("alarms");
  const [now, setNow] = useState<Date>(() => new Date());
  const [booted, setBooted] = useState(false);

  const t: Dict = translations[language];
  const tr = (key: string): string => ((t as unknown as Record<string, string>)[key] || key);
  const isDark = theme === "dark";
  const isRTL = language === "ar";
  const ui = useMemo(() => tokens(isDark), [isDark]);

  /* ───────────── المنبهات المتعددة ───────────── */
  const [alarms, setAlarms] = useState<AlarmRecord[]>([]);
  const [sheet, setSheet] = useState<{ mode: "create" | "edit"; alarm: AlarmRecord | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AlarmRecord | null>(null);
  const [pendingEnableId, setPendingEnableId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDemo, setPendingDemo] = useState(false);
  const alarmsRef = useRef<AlarmRecord[]>(alarms);

  /* ───────────── الملف الشخصي والصوت ───────────── */
  const [userName, setUserName] = useState("");
  const userNameRef = useRef(userName);
  const languageRef = useRef<Language>(language);
  const [fastMode, setFastMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  /* ───────────── الرنين والتحقق ───────────── */
  const [ringingAlarm, setRingingAlarm] = useState<AlarmRecord | null>(null);
  const ringingAlarmRef = useRef<AlarmRecord | null>(ringingAlarm);
  const [alarmStage, setAlarmStage] = useState<AlarmStage>("idle");
  const alarmStageRef = useRef<AlarmStage>(alarmStage);
  const [timeSinceRinging, setTimeSinceRinging] = useState(0);
  const [verifyProgress, setVerifyProgress] = useState<Record<VerificationId, { completed: boolean; image: string | null }>>({
    water: { completed: false, image: null },
    prayer: { completed: false, image: null },
    face: { completed: false, image: null },
  });
  const [currentVerificationIndex, setCurrentVerificationIndex] = useState(0);
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{ valid: boolean; confidence: number; message: string; checks: VisionCheck[]; tips: string[] } | null>(null);
  const [cameraPermissionError, setCameraPermissionError] = useState(false);
  const [cameraErrorCode, setCameraErrorCode] = useState("");
  const [cameraStreamActive, setCameraStreamActive] = useState(false);
  const [snoozeCount, setSnoozeCount] = useState(0);
  const [snoozeHoldProgress, setSnoozeHoldProgress] = useState(0);
  const [isHoldingSnooze, setIsHoldingSnooze] = useState(false);

  /* ───────────── التثبيت والتحديث والأذونات ───────────── */
  const [deferredPrompt, setDeferredPrompt] = useState<unknown>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [installStep, setInstallStep] = useState<"idle" | "installing" | "success">("idle");
  const [showInstallSheet, setShowInstallSheet] = useState(false);
  const [showPermWizard, setShowPermWizard] = useState(false);
  const [permChecking, setPermChecking] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [apkInfo, setApkInfo] = useState<ApkInfo | null>(null);
  const [apkProgress, setApkProgress] = useState(0);
  const [apkDownloading, setApkDownloading] = useState(false);
  const [apkDownloaded, setApkDownloaded] = useState(false);
  const [apkError, setApkError] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; message: string } | null>(null);
  const [siteUrl, setSiteUrl] = useState("https://github.com/y5747m-gif/moslm-we-bas-");

  /* ───────────── مراجع الصوت/الكاميرا ───────────── */
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speechIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const escalationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verificationSpeechRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const snoozeHoldRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const snoozeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2600);
  }, []);

  /* ═══════════════════════ الإقلاع: قراءة المحفوظات ═══════════════════════ */
  // التهيئة من التخزين المحلي تتم بعد أول رسم (تفادياً لعدم تطابق الخادم/العميل)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("hatsally-lang") as Language | null;
      const savedTheme = localStorage.getItem("hatsally-theme") as Theme | null;
      if (savedLang === "ar" || savedLang === "en") setLanguage(savedLang);
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) setTheme("light");

      const savedName = localStorage.getItem("hatsally-user-name");
      if (savedName) setUserName(savedName);
      if (localStorage.getItem("hatsally-fast-mode") === "true") setFastMode(true);
      if (localStorage.getItem("hatsally-muted") === "true") setIsMuted(true);

      // قائمة المنبهات (مع ترحيل المنبه الواحد القديم)
      let list = loadAlarms();
      if (list.length === 0) {
        // أول تشغيل: منبه فجر جاهز (غير مفعّل حتى يمنح المستخدم الأذونات)
        list = [createAlarm(defaultAlarm({ label: savedLang === "en" ? "Fajr" : "الفجر", time: "05:00", enabled: false }))];
        saveAlarms(list);
      }
      setAlarms(list);
      setSiteUrl(window.location.origin || siteUrl);

      // اختصارات التطبيق: /?action=add-alarm | set-alarm | try
      const action = new URLSearchParams(window.location.search).get("action");
      if (action === "add-alarm" || action === "set-alarm") setSheet({ mode: "create", alarm: null });
      else if (action === "try") setPendingDemo(true);
    } catch {
      /* تجاهل - التخزين غير متاح */
    }
    setBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* حفظ المنبهات فور تغييرها */
  useEffect(() => {
    if (!booted) return;
    saveAlarms(alarms);
  }, [alarms, booted]);

  useEffect(() => {
    if (!booted) return;
    try {
      localStorage.setItem("hatsally-lang", language);
      localStorage.setItem("hatsally-theme", theme);
      localStorage.setItem("hatsally-user-name", userName);
      localStorage.setItem("hatsally-fast-mode", fastMode ? "true" : "false");
      localStorage.setItem("hatsally-muted", isMuted ? "true" : "false");
    } catch {
      /* تجاهل */
    }
    document.documentElement.lang = language;
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.classList.toggle("light", !isDark);
  }, [language, theme, userName, fastMode, isMuted, isRTL, isDark, booted]);

  /* عدّاد الثواني الحي */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ═══════════════════════ مزامنة المنبهات مع النظام ═══════════════════════ */
  /**
   * كل منبه يُجدول في النظام (Service Worker + تنبيهات أندرويد الأصلية)
   * كتكرار يومي، فيرن في نفس الموعد كل يوم حتى لو التطبيق مغلق.
   */
  const pushToSystem = useCallback((list: AlarmRecord[], notify = false) => {
    const payload = list.map((a) => ({
      id: a.id,
      nid: a.nid,
      label: a.label,
      time: a.time,
      days: a.days,
      duration: a.durationDays,
      durationDays: a.durationDays,
      startDate: a.startDate,
      enabled: a.enabled,
      lastFiredKey: a.lastFiredKey,
    }));
    try {
      navigator.serviceWorker?.controller?.postMessage({
        type: "SET_ALARMS",
        alarms: payload,
        name: userNameRef.current,
        notify,
      });
    } catch {
      /* تجاهل */
    }
    void scheduleNativeAlarms({
      alarms: payload.map((p) => ({ id: p.id, nid: p.nid, label: p.label, time: p.time, days: p.days, enabled: p.enabled })),
      name: userNameRef.current,
      lang: languageRef.current,
    });
  }, []);

  useEffect(() => {
    if (!booted) return;
    // أثناء الرنين لا نعيد الجدولة: إعادة الجدولة تلغي الإشعار الدائم الذي يوقظ المستخدم
    if (alarmStage !== "idle") return;
    pushToSystem(alarms, false);
  }, [alarms, userName, language, booted, alarmStage, pushToSystem]);

  /* ═══════════════════════ الصوت: النغمات والنداء ═══════════════════════ */
  const stopOscillatorsOnly = useCallback(() => {
    oscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        /* انتهى */
      }
    });
    oscillatorsRef.current = [];
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        /* تجاهل */
      }
      audioContextRef.current = null;
    }
  }, []);

  const stopAllSounds = useCallback(() => {
    stopOscillatorsOnly();
    if (speechIntervalRef.current) {
      clearInterval(speechIntervalRef.current);
      speechIntervalRef.current = null;
    }
    if (verificationSpeechRef.current) {
      clearInterval(verificationSpeechRef.current);
      verificationSpeechRef.current = null;
    }
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* تجاهل */
      }
    }
    void stopNativeSpeech();
  }, [stopOscillatorsOnly]);

  const ensureAudioContext = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (Ctor) audioContextRef.current = new Ctor();
      }
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        void audioContextRef.current.resume();
      }
    } catch {
      /* تجاهل */
    }
    return audioContextRef.current;
  }, []);

  /* فتح قفل الصوت عند أي تفاعل - بدونه يرن المنبه صامتاً (سياسة المتصفح) */
  useEffect(() => {
    const unlock = () => ensureAudioContext();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchend", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchend", unlock);
    };
  }, [ensureAudioContext]);

  useEffect(() => {
    return () => {
      stopAllSounds();
      if (streamRef.current) streamRef.current.getTracks().forEach((x) => x.stop());
      if (snoozeHoldRef.current) clearInterval(snoozeHoldRef.current);
      if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    };
  }, [stopAllSounds]);

  const getBestMaleVoice = useCallback((langCode: string) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;
    const langVoices = voices.filter((v) => v.lang.toLowerCase().includes(langCode.toLowerCase()));
    const pool = langVoices.length > 0 ? langVoices : voices;
    const maleNames = [
      "maged", "majed", "majid", "naayf", "nayef", "naif", "tarik", "tariq", "omar", "ahmed", "ahmad",
      "mohamed", "mohammed", "khalid", "abdullah", "youssef", "yousef", "yaseen", "yassin",
      "david", "mark", "alex", "daniel", "james", "john", "michael", "robert", "thomas", "william",
      "google uk english male", "google us english male",
    ];
    const femaleKeywords = [
      "female", "woman", "sara", "laila", "zara", "samantha", "karen", "moira", "tessa", "veena",
      "fiona", "susan", "lisa", "anna", "emma", "olivia", "amelie", "alice",
    ];
    return (
      pool.find((v) => {
        const n = v.name.toLowerCase();
        return n.includes("male") && !n.includes("female");
      }) ||
      pool.find((v) => maleNames.some((m) => v.name.toLowerCase().includes(m))) ||
      pool.find((v) => !femaleKeywords.some((f) => v.name.toLowerCase().includes(f))) ||
      langVoices[0] ||
      pool[0] ||
      null
    );
  }, []);

  const speak = useCallback(
    (text: string, opts: { rate?: number; pitch?: number } = {}) => {
      if (isMuted) return;
      const langTag = language === "ar" ? "ar-SA" : "en-US";
      // داخل تطبيق APK: النطق عبر محرك الهاتف (WebView لا يدعم speechSynthesis)
      if (isNativeApp) {
        void nativeSpeak(text, { lang: langTag, rate: opts.rate ?? 0.9, pitch: opts.pitch ?? 0.65 });
        return;
      }
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = langTag;
      u.rate = opts.rate ?? 0.88;
      u.pitch = opts.pitch ?? 0.42; // نبرة منخفضة = صوت رجل
      u.volume = 1;
      const best = getBestMaleVoice(language === "ar" ? "ar" : "en");
      if (best) u.voice = best;
      if (window.speechSynthesis.getVoices().length === 0) {
        // الأصوات تُحمَّل لاحقاً: أعد النطق بنفس الجمهة بعد لحظة
        window.setTimeout(() => {
          try {
            const retry = getBestMaleVoice(language === "ar" ? "ar" : "en");
            if (retry) u.voice = retry;
            window.speechSynthesis.speak(u);
          } catch {
            /* تجاهل */
          }
        }, 240);
        return;
      }
      window.speechSynthesis.speak(u);
    },
    [getBestMaleVoice, isMuted, isNativeApp, language]
  );

  const speakWakeUp = useCallback(
    (name: string, urgent = false, label = "") => {
      const what = label ? (language === "ar" ? ` - ${label}` : ` - ${label}`) : "";
      const text = urgent
        ? language === "ar"
          ? `استيقظ يا ${name}! استيقظ حالاً يا ${name}! وقت الصلاة قد حان${what}! قم يا ${name}!`
          : `Wake up ${name}! Wake up now ${name}! Prayer time is here${what}! Get up ${name}!`
        : language === "ar"
          ? `استيقظ يا ${name}... حان وقت المنبه${what} يا ${name}... قم للصلاة يا ${name}...`
          : `Wake up ${name}... alarm time${what}... get up for prayer ${name}...`;
      speak(text, { rate: urgent ? 0.95 : 0.84, pitch: urgent ? 0.55 : 0.4 });
    },
    [language, speak]
  );

  const speakVerification = useCallback(
    (taskId: VerificationId, name: string) => {
      let text = "";
      if (language === "ar") {
        if (taskId === "water") text = `يا ${name} صور صنبور المياه الآن لإثبات الوضوء! هيا يا ${name}!`;
        else if (taskId === "prayer") text = `أحسنت يا ${name}! الآن صور المصلاة يا ${name}! ممتاز يا بطل!`;
        else text = `ممتاز يا ${name}! الآن صور وجهك وعيناك مفتوحتان يا ${name}! افتح عينيك جيداً!`;
      } else {
        if (taskId === "water") text = `${name}, photograph the water tap now to prove wudu! Come on ${name}!`;
        else if (taskId === "prayer") text = `Good ${name}! Now photograph the prayer mat! Excellent!`;
        else text = `Excellent ${name}! Now photograph your face with eyes open! Open your eyes wide!`;
      }
      speak(text, { rate: 0.92, pitch: 0.5 });
    },
    [language, speak]
  );

  const playGentleTone = useCallback(() => {
    if (isMuted) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440;
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    oscillatorsRef.current.push(osc);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5);
    setTimeout(() => {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      setTimeout(() => {
        try {
          osc.stop();
        } catch {
          /* انتهى */
        }
      }, 600);
    }, 2000);
  }, [ensureAudioContext, isMuted]);

  const playGentleToneForVerification = useCallback(() => {
    if (isMuted) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      try {
        osc.stop();
      } catch {
        /* انتهى */
      }
    }, 400);
  }, [ensureAudioContext, isMuted]);

  const playAnnoyingSounds = useCallback(() => {
    if (isMuted) return;
    stopOscillatorsOnly();
    const ctx = ensureAudioContext();
    if (!ctx) return;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? "square" : i === 1 ? "sawtooth" : "triangle";
      osc.frequency.value = 800 + Math.random() * 600 + i * 200;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 5 + i;
      lfoGain.gain.value = 200;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
      oscillatorsRef.current.push(osc, lfo);
      const blink = setInterval(() => {
        gain.gain.value = gain.gain.value > 0 ? 0 : 0.2;
      }, 300 + i * 100);
      setTimeout(() => clearInterval(blink), 10000);
    }
  }, [ensureAudioContext, isMuted, stopOscillatorsOnly]);

  const playExtremeSounds = useCallback(() => {
    if (isMuted) return;
    stopOscillatorsOnly();
    const ctx = ensureAudioContext();
    if (!ctx) return;
    for (let i = 0; i < 5; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = ["square", "sawtooth", "triangle", "square", "sawtooth"][i] as OscillatorType;
      osc.frequency.value = 300 + Math.random() * 2000;
      filter.type = "bandpass";
      filter.frequency.value = 1000 + Math.random() * 2000;
      gain.gain.value = 0.25;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      const jump = setInterval(() => {
        osc.frequency.linearRampToValueAtTime(200 + Math.random() * 3000, ctx.currentTime + 0.1);
        gain.gain.linearRampToValueAtTime(Math.random() * 0.4 + 0.1, ctx.currentTime + 0.1);
      }, 150 + Math.random() * 300);
      oscillatorsRef.current.push(osc);
      setTimeout(() => clearInterval(jump), 15000);
    }
    // ضوضاء بيضاء تزيد الإزعاج
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.1;
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();
  }, [ensureAudioContext, isMuted, stopOscillatorsOnly]);

  /* مهام التحقق الثلاث مشتقة من اللغة + ما أُنجز (لا تأثيرات جانبية) */
  const verificationTasks = useMemo<VerificationTask[]>(
    () => [
      { id: "water", title: t.waterTap, subtitle: t.waterDesc, icon: <Droplets className="w-6 h-6" />, ...verifyProgress.water },
      { id: "prayer", title: t.prayerMat, subtitle: t.prayerDesc, icon: <div className="text-xl">🕌</div>, ...verifyProgress.prayer },
      {
        id: "face",
        title: language === "ar" ? "وجهك وعيناك مفتوحتان" : "Your face with eyes open",
        subtitle: t.faceDesc,
        icon: <Eye className="w-6 h-6" />,
        ...verifyProgress.face,
      },
    ],
    [language, t.waterTap, t.waterDesc, t.prayerMat, t.prayerDesc, t.faceDesc, verifyProgress]
  );

  /* ═══════════════════════ بدء الرنين ═══════════════════════ */
  const triggerAlarm = useCallback(
    (alarm: AlarmRecord | null, opts?: { demo?: boolean; alreadyMarked?: boolean }) => {
      const stamp = getTodayKey(new Date());
      if (alarm && !opts?.demo && !opts?.alreadyMarked) {
        setAlarms((prev) => markFired(prev, [alarm.id], stamp));
      }
      ensureAudioContext();
      setRingingAlarm(alarm);
      ringingAlarmRef.current = alarm;
      setAlarmStage("ringing");
      setTimeSinceRinging(0);
      setSnoozeCount(0);
      warmUpVerification();
      // فرض الاستيقاظ: صوت أقصى + شاشة مستيقظة فوق القفل
      void enforceRinging();
      const name = userNameRef.current || (languageRef.current === "ar" ? "بطل الفجر" : "Fajr hero");
      speakWakeUp(name, false, alarm?.label || "");
      playGentleTone();
      if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
      speechIntervalRef.current = setInterval(() => {
        speakWakeUp(userNameRef.current || name, false, alarm?.label || "");
        playGentleTone();
      }, 6000);
      haptic([1000, 500, 1000, 500, 2000]);
      try {
        navigator.serviceWorker?.controller?.postMessage({
          type: "TRIGGER_ALARM",
          name,
          stage: "ringing",
          alarmId: alarm?.id,
          label: alarm?.label,
          time: alarm?.time,
        });
      } catch {
        /* تجاهل */
      }
    },
    [ensureAudioContext, playGentleTone, speakWakeUp]
  );

  const triggerAlarmRef = useRef(triggerAlarm);

  /**
   * مزامنة المراجع بعد كل رسم (بدلاً من الكتابة فيها أثناء الرسم):
   * المؤقتات ومعالجات الأحداث تقرأ أحدث قيمة دائماً.
   */
  useEffect(() => {
    alarmsRef.current = alarms;
    userNameRef.current = userName;
    languageRef.current = language;
    ringingAlarmRef.current = ringingAlarm;
    alarmStageRef.current = alarmStage;
    triggerAlarmRef.current = triggerAlarm;
  });

  /* تجربة الرنين المطلوبة من اختصار التطبيق (?action=try) */
  const demoDoneRef = useRef(false);
  useEffect(() => {
    if (!booted || !pendingDemo || demoDoneRef.current) return;
    demoDoneRef.current = true;
    const list = alarmsRef.current;
    triggerAlarm(list.find((a) => a.enabled) || list[0] || null, { demo: true });
  }, [booted, pendingDemo, triggerAlarm]);

  /* التصعيد: لطيف ← مزعج ← كابوس */
  useEffect(() => {
    if (alarmStage === "idle" || alarmStage === "verification" || alarmStage === "completed") return;
    const escalationTime = fastMode ? 15 : 5 * 60;
    const extremeTime = fastMode ? 30 : 10 * 60;
    const id = setInterval(() => {
      setTimeSinceRinging((prev) => {
        const next = prev + 1;
        if (next === escalationTime && alarmStage === "ringing") {
          setAlarmStage("annoying");
          playAnnoyingSounds();
          speakWakeUp(userNameRef.current || "بطل الفجر", true, ringingAlarmRef.current?.label || "");
          if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
          speechIntervalRef.current = setInterval(() => {
            speakWakeUp(userNameRef.current || "بطل الفجر", true, ringingAlarmRef.current?.label || "");
          }, 8000);
          try {
            navigator.serviceWorker?.controller?.postMessage({
              type: "TRIGGER_ALARM",
              name: userNameRef.current,
              stage: "annoying",
              alarmId: ringingAlarmRef.current?.id,
              label: ringingAlarmRef.current?.label,
              time: ringingAlarmRef.current?.time,
            });
          } catch {
            /* تجاهل */
          }
        } else if (next === extremeTime && alarmStage === "annoying") {
          setAlarmStage("extreme");
          playExtremeSounds();
          try {
            navigator.serviceWorker?.controller?.postMessage({
              type: "TRIGGER_ALARM",
              name: userNameRef.current,
              stage: "extreme",
              alarmId: ringingAlarmRef.current?.id,
            });
          } catch {
            /* تجاهل */
          }
        }
        return next;
      });
    }, 1000);
    escalationIntervalRef.current = id;
    return () => clearInterval(id);
  }, [alarmStage, fastMode, playAnnoyingSounds, playExtremeSounds, speakWakeUp]);

  /* ═══════════════════════ فحص المواعيد: كل يوم في نفس الوقت ═══════════════════════ */
  const runAlarmCheck = useCallback(() => {
    if (alarmStageRef.current !== "idle") return;
    const nowD = new Date();
    let list = alarmsRef.current;

    // إيقاف من انتهت مدته تلقائياً
    const exp = autoExpire(list, nowD);
    if (exp.changed) {
      list = exp.list;
      setAlarms(list);
    }

    const due = dueAlarms(nowD, list);
    if (due.length > 0) {
      const stamp = getTodayKey(nowD);
      // تعليم كل المستحقة الآن (استيقاظ واحد يكفي عنها جميعاً)
      setAlarms((prev) => markFired(prev, due.map((d) => d.alarm.id), stamp));
      console.log(`⏰ Ringing ${due.length === 1 ? "alarm" : `${due.length} alarms (first)`}:`, due[0].alarm.time, due[0].alarm.label);
      triggerAlarmRef.current(due[0].alarm, { alreadyMarked: true });
      return;
    }

    // فات الموعد بأكثر من المهلة: يُعلَّم اليوم بصمت حتى لا يرن متأخراً
    const missed = missedAlarms(nowD, list);
    if (missed.length > 0) {
      setAlarms((prev) => markFired(prev, missed.map((a) => a.id), getTodayKey(nowD)));
    }
  }, []);

  useEffect(() => {
    if (!booted) return;
    runAlarmCheck();
    const id = setInterval(runAlarmCheck, 1000);
    const onReturn = () => {
      if (!document.hidden) runAlarmCheck();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    window.addEventListener("online", onReturn);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("online", onReturn);
    };
  }, [booted, runAlarmCheck]);

  /* ═══════════════════════ التطبيق الأصلي (APK) ═══════════════════════ */
  // كشف بيئة التشغيل (APK/PWA) يحدث بعد الرسم الأول
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (checkNativeApp()) {
      setIsNativeApp(true);
      setIsInstalled(true);
      try {
        localStorage.setItem("hatsally-installed", "true");
        localStorage.setItem("hatsally-native", "true");
      } catch {
        /* تجاهل */
      }
      void requestNativePermissions();
      // منع زر الرجوع من إغلاق التطبيق أثناء الرنين
      void guardBackButtonWhileRinging(() => {
        const s = alarmStageRef.current;
        return s === "ringing" || s === "annoying" || s === "extreme" || s === "verification";
      });
    } else {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        localStorage.getItem("hatsally-installed") === "true";
      setIsInstalled(standalone);
    }
    void getApkInfo().then((info) => info && setApkInfo(info));
    if ("Notification" in window) setNotificationPermission(Notification.permission);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setInstallStep("success");
      try {
        localStorage.setItem("hatsally-installed", "true");
      } catch {
        /* تجاهل */
      }
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* الضغط على تنبيه المنبه الأصلي يبدأ رنين ذلك المنبه فوراً */
  useEffect(() => {
    if (!isNativeApp) return;
    let off: (() => void) | null = null;
    void onNativeAlarmTap((extra) => {
      if (alarmStageRef.current !== "idle") return;
      const id = typeof extra.alarmId === "string" ? extra.alarmId : null;
      const list = alarmsRef.current;
      const target = (id && list.find((a) => a.id === id)) || list.find((a) => a.enabled) || list[0] || null;
      triggerAlarmRef.current(target);
    }).then((fn) => {
      off = fn;
    });
    return () => {
      if (off) off();
    };
  }, [isNativeApp]);

  /* رسائل الـ Service Worker: رنين + إحياء الإشعار + التحديث التلقائي */
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;
      if (data.type === "ALARM_TRIGGERED" || data.type === "NOTIFICATION_WAKE") {
        if (alarmStageRef.current !== "idle") return;
        const list = alarmsRef.current;
        const target =
          (typeof data.alarmId === "string" && list.find((a) => a.id === data.alarmId)) ||
          list.find((a) => a.enabled) ||
          list[0] ||
          null;
        triggerAlarmRef.current(target);
      }
      if (data.type === "NOTIFICATION_RESURRECTED") {
        const s = alarmStageRef.current;
        if (s !== "idle" && s !== "completed") {
          playExtremeSounds();
          speakWakeUp(userNameRef.current || "بطل الفجر", true);
        }
      }
      if (data.type === "APP_UPDATED") {
        setUpdateInfo({
          version: data.version || APP_VERSION,
          message: language === "ar" ? "تم تحديث التطبيق تلقائياً - منبهات متعددة وكل منبه يرن كل يوم" : "App updated - multiple alarms, each ringing daily",
        });
        haptic([100, 50, 100, 50, 200]);
        try {
          localStorage.setItem("hatsally-update-pending", "true");
        } catch {
          /* تجاهل */
        }
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [language, playExtremeSounds, speakWakeUp]);

  /* منع الإغلاق/الرجوع أثناء الرنين */
  useEffect(() => {
    const shouldBlock = alarmStage === "ringing" || alarmStage === "annoying" || alarmStage === "extreme" || alarmStage === "verification";
    if (!shouldBlock) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = language === "ar" ? "المنبه يرن! لا يمكن الإغلاق إلا بالتصوير!" : "Alarm ringing! Only photo verification stops it!";
      return e.returnValue;
    };
    const onHidden = () => {
      if (!document.hidden) return;
      speakWakeUp(userNameRef.current || "بطل الفجر", true, ringingAlarmRef.current?.label || "");
      haptic([500, 200, 500, 200, 1000]);
      const title = `⏰ ${t.cannotClose}`;
      const body = language === "ar" ? "المنبه لا يزال يعمل! لن يتوقف إلا بالتصوير" : "Alarm still ringing! Only photos stop it";
      if (isNativeApp) void notifyNative(title, body);
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(title, { body, icon: "/icons/icon-192.png", requireInteraction: true, tag: "persistent-alarm" } as NotificationOptions);
        } catch {
          /* تجاهل */
        }
      }
    };
    const pushState = () => history.pushState(null, "", location.href);
    const onPopState = () => {
      pushState();
      alert(language === "ar" ? "لا يمكن الرجوع! المنبه يرن - يجب التصوير أولاً!" : "Cannot go back! Alarm ringing - verify with photos!");
      speakWakeUp(userNameRef.current || "بطل الفجر", true);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("popstate", onPopState);
    pushState();
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("popstate", onPopState);
    };
  }, [alarmStage, language, t.cannotClose, speakWakeUp, isNativeApp]);

  /* ═══════════════════════ إدارة المنبهات ═══════════════════════ */
  const openCreateSheet = () => {
    if (alarms.length >= MAX_ALARMS) {
      showToast(language === "ar" ? "وصلت للحد الأقصى من المنبهات" : "You reached the alarms limit");
      return;
    }
    setSheet({ mode: "create", alarm: null });
  };

  /** حفظ منبه (جديد أو معدّل) - مع بوابة الأذونات قبل التفعيل */
  const commitAlarm = useCallback(
    async (draft: AlarmDraft, existingId?: string) => {
      let name = userNameRef.current.trim();
      if (!name) {
        name = languageRef.current === "ar" ? "بطل الفجر" : "Fajr hero";
        setUserName(name);
      }
      const startDate = draft.durationDays === "forever" ? null : new Date().toISOString();
      const nowD = new Date();
      const prev = existingId ? alarmsRef.current.find((a) => a.id === existingId) : undefined;
      if (existingId && !prev) return;
      const changed = prev
        ? prev.time !== draft.time ||
          prev.days.join(",") !== draft.days.join(",") ||
          prev.durationDays !== draft.durationDays
        : true;

      let record: AlarmRecord = prev
        ? { ...prev, ...draft, startDate: startDate ?? prev.startDate }
        : createAlarm({ ...draft, startDate });

      // علامة "رنّ اليوم": منبه جديد أو موعد معدّل = تسليح كامل،
      // وإن كان موعد اليوم قد فات بكثير يبدأ غداً (لا رنين مفاجئ لحظة الحفظ)
      record = {
        ...record,
        lastFiredKey: passedTodayBeyondGrace(record, nowD)
          ? getTodayKey(nowD)
          : changed
            ? null
            : (prev?.lastFiredKey ?? null),
      };

      let needPerms = false;
      if (record.enabled) {
        const crit = await checkCritical();
        if (!crit.ok) {
          needPerms = true;
          record = { ...record, enabled: false };
        }
      }

      const next = upsertAlarm(alarmsRef.current, record);
      setAlarms(next);
      setSheet(null);
      pushToSystem(next, true);

      if (needPerms) {
        setPendingEnableId(record.id);
        setShowPermWizard(true);
        showToast(t.permNeededForAlarm);
      } else {
        showToast(record.enabled ? `${t.alarmSaved} • ${record.time} ${isDaily(record) ? t.everyday : ""}` : t.alarmSaved);
      }
    },
    [pushToSystem, showToast, t]
  );

  /** تسليح منبه بعد التأكد من الأذونات (يبدأ من اليوم أو الغد حسب الموعد) */
  const armAlarmById = useCallback(
    (id: string) => {
      const target = alarmsRef.current.find((a) => a.id === id);
      if (!target) return;
      const next = patchAlarm(alarmsRef.current, id, armAlarm(target, new Date()));
      setAlarms(next);
      pushToSystem(next, true);
      showToast(t.alarmArmed);
    },
    [pushToSystem, showToast, t]
  );

  /** تفعيل/إيقاف منبه - التفعيل يمرّ عبر الأذونات الحرجة */
  const toggleAlarm = useCallback(
    async (id: string, nextEnabled: boolean) => {
      if (!nextEnabled) {
        const next = patchAlarm(alarmsRef.current, id, { enabled: false });
        setAlarms(next);
        pushToSystem(next, false);
        showToast(t.alarmOff);
        return;
      }
      const crit = await checkCritical();
      if (!crit.ok) {
        setPendingEnableId(id);
        setShowPermWizard(true);
        return;
      }
      armAlarmById(id);
    },
    [armAlarmById, pushToSystem, showToast, t]
  );

  const deleteAlarmById = useCallback(
    (id: string) => {
      const next = removeAlarm(alarmsRef.current, id);
      setAlarms(next);
      setConfirmDelete(null);
      setSheet(null);
      pushToSystem(next, false);
      if (next.length === 0) void cancelNativeAlarm();
      showToast(t.alarmDeleted);
    },
    [pushToSystem, showToast, t]
  );

  /* ═══════════════════════ التحقق بالتصوير ═══════════════════════ */
  const analyzeImageWithAI = useCallback(
    async (imageDataUrl: string, taskId: VerificationId, attempt: number) => {
      const r = await verifyCapture(imageDataUrl, taskId as VerifyTask, attempt);
      const dict = translations[language] as unknown as Record<string, string>;
      return {
        valid: r.valid,
        confidence: r.confidence,
        message: dict[r.messageKey] || r.messageKey,
        checks: r.checks,
        tips: r.tips,
      };
    },
    [language]
  );

  useEffect(() => {
    if (isCameraOpen && streamRef.current && videoRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraOpen]);

  const openCamera = useCallback(async (taskId?: VerificationId) => {
    const currentTaskId = taskId || "water";
    setCameraPermissionError(false);
    setCameraErrorCode("");
    setAiResult(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((x) => {
          try {
            x.stop();
          } catch {
            /* تجاهل */
          }
        });
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch {
      /* تجاهل */
    }
    const fail = (code: string) => {
      setCameraErrorCode(code);
      setCameraPermissionError(true);
      setCameraStreamActive(false);
    };
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        fail("unsupported");
        return;
      }
      const facingMode = currentTaskId === "face" ? "user" : "environment";
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (firstErr: unknown) {
        const n = (firstErr as { name?: string })?.name || "";
        if (n === "NotAllowedError" || n === "PermissionDeniedError" || n === "SecurityError") throw firstErr;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setCameraStreamActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraOpen(true);
      setCapturedImage(null);
      haptic(50);
    } catch (err: unknown) {
      const n = (err as { name?: string })?.name || "";
      if (n === "NotAllowedError" || n === "PermissionDeniedError" || n === "SecurityError") fail("denied");
      else if (n === "NotFoundError" || n === "DevicesNotFoundError" || n === "OverconstrainedError") fail("missing");
      else if (n === "NotReadableError" || n === "TrackStartError" || n === "AbortError") fail("busy");
      else fail("unknown");
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (verificationTasks[currentVerificationIndex]?.id === "face") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    setCapturedImage(canvas.toDataURL("image/jpeg", 0.85));
    haptic([30, 20, 30]);
  }, [currentVerificationIndex, verificationTasks]);

  const confirmCapture = useCallback(
    async (forcePass = false) => {
      if (!capturedImage) return;
      const currentTaskId = verificationTasks[currentVerificationIndex]?.id;
      if (!currentTaskId) return;

      if (forcePass && aiResult) {
        if (aiResult.confidence < 25 && verificationAttempts < 2) {
          haptic([100, 50, 100]);
          return;
        }
        setAiResult({ ...aiResult, valid: true, message: language === "ar" ? "تم التأكيد ✓" : "Confirmed ✓" });
      } else {
        setAiAnalyzing(true);
        setAiResult(null);
        try {
          const check = await analyzeImageWithAI(capturedImage, currentTaskId, verificationAttempts);
          setAiResult(check);
          setAiAnalyzing(false);
          setVerificationAttempts((p) => p + 1);
          if (!check.valid) {
            haptic([80, 40, 80]);
            return;
          }
        } catch {
          setAiAnalyzing(false);
          setAiResult({
            valid: false,
            confidence: 10,
            message: language === "ar" ? "تعذر تحليل الصورة - أعد التصوير" : "Analysis failed - retake photo",
            checks: [],
            tips: ["tipFaceRetry"],
          });
          return;
        }
      }

      haptic([50, 30, 50, 30, 100]);
      setVerifyProgress((prev) => ({ ...prev, [currentTaskId]: { completed: true, image: capturedImage } }));
      if (streamRef.current) streamRef.current.getTracks().forEach((x) => x.stop());
      setIsCameraOpen(false);
      setCameraStreamActive(false);
      setCapturedImage(null);
      setAiResult(null);

      if (currentVerificationIndex < verificationTasks.length - 1) {
        const nextIndex = currentVerificationIndex + 1;
        setCurrentVerificationIndex(nextIndex);
        setVerificationAttempts(0);
        const nextTaskId = verificationTasks[nextIndex]?.id || "prayer";
        setTimeout(() => speakVerification(nextTaskId, userNameRef.current || "بطل الفجر"), 500);
        if (verificationSpeechRef.current) clearInterval(verificationSpeechRef.current);
        verificationSpeechRef.current = setInterval(() => {
          speakVerification(verificationTasks[nextIndex]?.id || nextTaskId, userNameRef.current || "بطل الفجر");
          playGentleToneForVerification();
        }, 10000);
        void openCamera(nextTaskId);
        return;
      }

      /* اكتمل التحقق الثلاثي */
      if (verificationSpeechRef.current) {
        clearInterval(verificationSpeechRef.current);
        verificationSpeechRef.current = null;
      }
      if (speechIntervalRef.current) {
        clearInterval(speechIntervalRef.current);
        speechIntervalRef.current = null;
      }
      stopOscillatorsOnly();
      if ("speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* تجاهل */
        }
      }
      void stopNativeSpeech();
      void relaxAfterRinging();
      setAlarmStage("completed");
      try {
        navigator.serviceWorker?.controller?.postMessage({ type: "ALARM_COMPLETED", name: userNameRef.current });
      } catch {
        /* تجاهل */
      }
      // المنبهات تبقى مفعّلة: كل منبه يعود للرنين غداً في نفس موعده
      pushToSystem(alarmsRef.current, false);
      speak(
        language === "ar"
          ? `تقبل الله يا ${userNameRef.current || "بطل الفجر"}! أحسنت الوضوء والاستيقاظ!`
          : `May Allah accept ${userNameRef.current || "hero"}! Well done!`,
        { rate: 0.9, pitch: 0.45 }
      );
    },
    [
      aiResult,
      analyzeImageWithAI,
      capturedImage,
      currentVerificationIndex,
      language,
      openCamera,
      playGentleToneForVerification,
      pushToSystem,
      speak,
      speakVerification,
      stopOscillatorsOnly,
      verificationAttempts,
      verificationTasks,
    ]
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCapturedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  /* الانتقال من الرنين إلى التحقق */
  const handleWakeUp = () => {
    if (escalationIntervalRef.current) {
      clearInterval(escalationIntervalRef.current);
      escalationIntervalRef.current = null;
    }
    if (speechIntervalRef.current) {
      clearInterval(speechIntervalRef.current);
      speechIntervalRef.current = null;
    }
    setAlarmStage("verification");
    setCurrentVerificationIndex(0);
    setVerificationAttempts(0);
    setAiResult(null);
    const first = verificationTasks[0]?.id || "water";
    void openCamera(first);
    speakVerification(first, userNameRef.current || "بطل الفجر");
    if (verificationSpeechRef.current) clearInterval(verificationSpeechRef.current);
    verificationSpeechRef.current = setInterval(() => {
      speakVerification(verificationTasks[currentVerificationIndex]?.id || "water", userNameRef.current || "بطل الفجر");
      playGentleToneForVerification();
    }, 10000);
    try {
      navigator.serviceWorker?.controller?.postMessage({
        type: "TRIGGER_ALARM",
        name: userNameRef.current,
        stage: "verification",
        alarmId: ringingAlarmRef.current?.id,
        label: ringingAlarmRef.current?.label,
      });
    } catch {
      /* تجاهل */
    }
  };

  /* الغفوة: واحدة فقط، بالضغط المطول */
  const handleSnooze = () => {
    if (snoozeCount >= 1) {
      alert(language === "ar" ? "تم استخدام الغفوة! لا يمكن إغلاقه إلا بالتصوير!" : "Snooze used! Only photo verification stops it!");
      playExtremeSounds();
      haptic([200, 100, 200, 100, 500]);
      return;
    }
    setSnoozeCount((c) => c + 1);
    stopAllSounds();
    setAlarmStage("idle");
    setTimeSinceRinging(0);
    setSnoozeHoldProgress(0);
    setIsHoldingSnooze(false);
    const alarm = ringingAlarmRef.current;
    if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    snoozeTimerRef.current = setTimeout(() => {
      triggerAlarmRef.current(alarm, { demo: true });
    }, fastMode ? 10000 : 5 * 60 * 1000);
  };

  const handleSnoozeHoldStart = () => {
    if (snoozeCount >= 1) {
      handleSnooze();
      return;
    }
    setIsHoldingSnooze(true);
    setSnoozeHoldProgress(0);
    const start = Date.now();
    if (snoozeHoldRef.current) clearInterval(snoozeHoldRef.current);
    snoozeHoldRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(100, (elapsed / 3000) * 100);
      setSnoozeHoldProgress(progress);
      if (elapsed >= 3000) {
        if (snoozeHoldRef.current) clearInterval(snoozeHoldRef.current);
        setIsHoldingSnooze(false);
        setSnoozeHoldProgress(0);
        handleSnooze();
      }
    }, 50);
  };

  const handleSnoozeHoldEnd = () => {
    if (snoozeHoldRef.current) {
      clearInterval(snoozeHoldRef.current);
      snoozeHoldRef.current = null;
    }
    setIsHoldingSnooze(false);
    setSnoozeHoldProgress(0);
  };

  /** إغلاق شاشة "تم" - المنبهات تبقى مسلّحة لترن غداً في نفس الموعد */
  const closeCompleted = () => {
    stopAllSounds();
    void relaxAfterRinging();
    if (verificationSpeechRef.current) {
      clearInterval(verificationSpeechRef.current);
      verificationSpeechRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((x) => x.stop());
      streamRef.current = null;
    }
    setAlarmStage("idle");
    setRingingAlarm(null);
    ringingAlarmRef.current = null;
    setTimeSinceRinging(0);
    setSnoozeCount(0);
    setVerifyProgress({
      water: { completed: false, image: null },
      prayer: { completed: false, image: null },
      face: { completed: false, image: null },
    });
    setCurrentVerificationIndex(0);
    setVerificationAttempts(0);
    setAiResult(null);
    setCapturedImage(null);
    setIsCameraOpen(false);
    setCameraPermissionError(false);
    setCameraStreamActive(false);
    setTab("alarms");
    runAlarmCheck();
  };

  /* ═══════════════════════ التثبيت وتحميل APK ═══════════════════════ */
  const handleInstallApp = async () => {
    setInstallStep("installing");
    try {
      if ("Notification" in window && Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
      }
      const prompt = deferredPrompt as { prompt?: () => void; userChoice?: Promise<{ outcome: string }> } | null;
      if (prompt && typeof prompt.prompt === "function") {
        prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome === "accepted") {
          setIsInstalled(true);
          setDeferredPrompt(null);
          try {
            localStorage.setItem("hatsally-installed", "true");
          } catch {
            /* تجاهل */
          }
        }
        setDeferredPrompt(null);
      } else if ("serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.ready;
        } catch {
          /* تجاهل */
        }
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true;
        if (standalone) {
          setIsInstalled(true);
          try {
            localStorage.setItem("hatsally-installed", "true");
          } catch {
            /* تجاهل */
          }
        }
      }
      haptic([100, 50, 100, 50, 200]);
      pushToSystem(alarmsRef.current, false);
      if (isNativeApp) {
        void notifyNative(
          language === "ar" ? "🎉 هتصلي جاهز على هاتفك!" : "🎉 HatSally is ready on your phone!",
          language === "ar" ? "كل منبهاتك محفوظة وسترن في مواعيدها كل يوم" : "All your alarms are saved and ring daily on time"
        );
      }
      const standaloneNow =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        localStorage.getItem("hatsally-installed") === "true";
      setInstallStep(standaloneNow ? "success" : "idle");
      if (standaloneNow) {
        setTimeout(() => {
          setInstallStep("idle");
          setShowInstallSheet(false);
        }, 3500);
      } else {
        showToast(language === "ar" ? "اتبع خطوات التثبيت اليدوي بالأسفل" : "Follow the manual install steps below");
      }
    } catch (e) {
      console.error("Install failed:", e);
      setInstallStep("idle");
      showToast(language === "ar" ? "تعذّر التثبيت - حاول مجدداً" : "Install failed - try again");
    }
  };

  const handleDownloadAPK = async () => {
    if (isIosDevice() && !isNativeApp) {
      showToast(language === "ar" ? "الآيفون لا يدعم APK - ثبّت من المتصفح" : "iOS has no APK - install from the browser");
      return;
    }
    setApkError(null);
    setApkDownloaded(false);
    setApkProgress(0);
    setShowInstallSheet(true);

    let info = apkInfo;
    if (!info) {
      info = await getApkInfo();
      if (info) setApkInfo(info);
    }
    const urls = [
      ...new Set([info?.available ? info.url : null, "/downloads/hatsally.apk", info?.releaseUrl || APK_RELEASE_URL].filter(Boolean) as string[]),
    ];

    setApkDownloading(true);
    for (const url of urls) {
      try {
        const blob = await downloadApk(url, (pct) => setApkProgress(pct));
        if (blob.size < 1024 * 1024) {
          const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
          if (!(head[0] === 0x50 && head[1] === 0x4b)) throw new Error("not an APK file");
        }
        triggerBlobDownload(blob, info?.fileName || "hatsally.apk");
        setApkDownloading(false);
        setApkDownloaded(true);
        setApkProgress(100);
        haptic([100, 50, 200]);
        return;
      } catch (e) {
        console.warn("APK download failed from", url, e);
        setApkProgress(0);
      }
    }
    setApkDownloading(false);
    setApkError(t.apkError);
  };

  /* ═══════════════════════ بيانات العرض ═══════════════════════ */
  const activeAlarms = alarms.filter((a) => a.enabled && !isAlarmExpired(now, a));
  const next = nextRingAmong(now, alarms);
  const displayName = userName.trim() || (language === "ar" ? "بطل الفجر" : "Fajr hero");
  const formatTimeSince = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: "alarms", label: t.navAlarms, icon: <AlarmClock className="w-[22px] h-[22px]" /> },
    { id: "verify", label: t.navVerify, icon: <Camera className="w-[22px] h-[22px]" /> },
    { id: "settings", label: t.navSettings, icon: <Zap className="w-[22px] h-[22px]" /> },
    { id: "about", label: t.navAbout, icon: <Info className="w-[22px] h-[22px]" /> },
  ];

  /* ═══════════════════════ شاشة: المنبهات ═══════════════════════ */
  const renderAlarms = () => (
    <div className="absolute inset-0 overflow-y-auto app-scroll animate-screen-in">
      <div className="px-4 pt-4 pb-28 space-y-4">
        <div>
          <h1 className={`text-[26px] font-black leading-tight ${ui.text}`}>{t.alarmsScreenTitle}</h1>
          <p className={`text-[12px] ${ui.textFaint} mt-0.5`}>{t.alarmsScreenSub}</p>
        </div>

        {/* بطاقة الرنين القادم */}
        <Card ui={ui} className="p-4 overflow-hidden relative">
          <div className="absolute -top-10 -end-10 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2">
            <BellRing className={`w-4 h-4 ${ui.accentText}`} />
            <p className={`text-[11px] font-black ${ui.textSoft}`}>{t.nextRing}</p>
            <span className={`ms-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${ui.cardSoft} border ${ui.border} ${ui.textFaint}`}>
              {activeAlarms.length} {t.activeAlarmsCount}
            </span>
          </div>
          {next ? (
            <>
              <div className="flex items-end gap-3 mt-2">
                <span className={`text-[46px] leading-none font-black tabular-nums ${ui.text}`} dir="ltr">
                  {String(next.at.getHours()).padStart(2, "0")}:{String(next.at.getMinutes()).padStart(2, "0")}
                </span>
                <div className="pb-1.5">
                  <p className={`text-[12px] font-bold ${ui.accentText}`}>
                    {next.alarm.label || (language === "ar" ? "منبه" : "Alarm")}
                  </p>
                  <p className={`text-[11px] ${ui.textFaint}`}>
                    {dayWord(now, next.at, t)} • {repeatSummary(next.alarm, t, language)}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <Progress
                  ui={ui}
                  value={Math.min(
                    100,
                    Math.max(
                      4,
                      100 - ((next.at.getTime() - now.getTime()) / (24 * 3600 * 1000)) * 100
                    )
                  )}
                />
                <p className={`text-[11px] font-bold mt-2 ${ui.textSoft} flex items-center gap-1.5`}>
                  <Timer className="w-3.5 h-3.5" />
                  {t.ringsIn} <span className="font-mono tabular-nums">{countdownText(now, next.at, language)}</span>
                  <span className={ui.textFaint}>• {isDaily(next.alarm) ? t.repeatDaily : repeatSummary(next.alarm, t, language)}</span>
                </p>
              </div>
            </>
          ) : (
            <div className="mt-3">
              <p className={`text-[13px] font-bold ${ui.textSoft}`}>{t.noActiveAlarms}</p>
              <p className={`text-[11.5px] ${ui.textFaint} mt-1 leading-relaxed`}>{t.noActiveAlarmsDesc}</p>
              <Button ui={ui} className="mt-3 h-11 w-full" onClick={openCreateSheet}>
                <Bell className="w-4 h-4" />
                {t.addAlarm}
              </Button>
            </div>
          )}
        </Card>

        {/* تذكير التثبيت */}
        {!isInstalled ? (
          <button
            onClick={() => {
              haptic(12);
              setShowInstallSheet(true);
            }}
            className={`w-full flex items-center gap-3 p-3.5 rounded-3xl border ${ui.accentSoft} active:scale-[0.99] transition`}
          >
            <span className="w-10 h-10 rounded-2xl bg-emerald-500 text-black flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0 text-start">
              <span className={`block text-[13px] font-black ${ui.text}`}>{t.installBannerTitle}</span>
              <span className={`block text-[11px] ${ui.textFaint} mt-0.5`}>{t.installBannerDesc}</span>
            </span>
            <ChevronLeft className={`w-4 h-4 ${ui.textFaint} ${isRTL ? "rotate-180" : ""}`} />
          </button>
        ) : null}

        {/* القائمة */}
        <SectionTitle ui={ui} hint={`${alarms.length} ${t.alarmsCountWord}`}>
          {t.unlimitedAlarms}
        </SectionTitle>

        {alarms.length === 0 ? (
          <Card ui={ui} className="p-8 text-center" soft>
            <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center mb-3">
              <AlarmClock className={`w-8 h-8 ${ui.accentText}`} />
            </div>
            <p className={`text-[14px] font-black ${ui.text}`}>{t.noAlarmsTitle}</p>
            <p className={`text-[11.5px] ${ui.textFaint} mt-1.5 leading-relaxed`}>{t.noAlarmsDesc}</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {alarms.map((alarm) => (
              <AlarmCard
                key={alarm.id}
                alarm={alarm}
                ui={ui}
                rtl={isRTL}
                language={language}
                t={t}
                now={now}
                nextRing={nextRingOf(now, alarm)}
                expired={isAlarmExpired(now, alarm)}
                // eslint-disable-next-line react-hooks/refs -- معالج حدث: تفعيل/إيقاف المنبه
                onToggle={(v) => void toggleAlarm(alarm.id, v)}
                onEdit={() => setSheet({ mode: "edit", alarm })}
                onDelete={() => setConfirmDelete(alarm)}
                // eslint-disable-next-line react-hooks/refs -- معالج حدث: يبدأ رنيناً تجريبياً لهذا المنبه
                onTest={() => triggerAlarm(alarm, { demo: true })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  /* ═══════════════════════ شاشة: التحقق ═══════════════════════ */
  const renderVerify = () => (
    <div className="absolute inset-0 overflow-y-auto app-scroll animate-screen-in">
      <div className="px-4 pt-4 pb-10 space-y-4">
        <div>
          <h1 className={`text-[26px] font-black leading-tight ${ui.text}`}>{t.verifyScreenTitle}</h1>
          <p className={`text-[12px] ${ui.textFaint} mt-0.5 leading-relaxed`}>{t.verifyScreenSub}</p>
        </div>

        <Card ui={ui} className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-red-400" />
            <p className={`text-[12.5px] font-black ${ui.text}`}>{t.hardToCloseTitle}</p>
            <span className="ms-auto text-[9.5px] px-2 py-0.5 rounded-full bg-red-500 text-white font-black animate-pulse">
              {t.cannotClose}
            </span>
          </div>
          <p className={`text-[11.5px] ${ui.textSoft} leading-relaxed`}>{t.hardToCloseDesc}</p>
        </Card>

        <SectionTitle ui={ui} hint="🤖 AI">{t.neverStops}</SectionTitle>
        <div className="space-y-2.5">
          {verificationTasks.map((task, i) => (
            <Card key={task.id} ui={ui} soft className="p-3.5 flex items-center gap-3">
              <span
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  task.completed ? "bg-emerald-500 text-black" : `${ui.cardSoft} border ${ui.border} ${ui.accentText}`
                }`}
              >
                {task.completed ? <Check className="w-5 h-5" /> : task.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-[13px] font-black ${ui.text}`}>
                  {t[`step${i + 1}` as keyof Dict] as string} • {task.title}
                </span>
                <span className={`block text-[11px] ${ui.textFaint} mt-0.5 leading-snug`}>{task.subtitle}</span>
              </span>
            </Card>
          ))}
        </div>

        <SectionTitle ui={ui}>{t.escalationTitle}</SectionTitle>
        <Card ui={ui} className="p-4 space-y-3">
          {[
            { name: t.stage1Name, at: t.stageAt1, tone: "bg-emerald-500", icon: <BellRing className="w-4 h-4 text-black" /> },
            { name: t.stage2Name, at: t.stageAt2, tone: "bg-amber-400", icon: <Volume2 className="w-4 h-4 text-black" /> },
            { name: t.stage3Name, at: t.stageAt3, tone: "bg-red-500", icon: <ShieldAlert className="w-4 h-4 text-white" /> },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className={`w-9 h-9 rounded-2xl ${s.tone} flex items-center justify-center shrink-0`}>{s.icon}</span>
              <span className="flex-1 min-w-0">
                <span className={`block text-[12.5px] font-bold ${ui.text}`}>{s.name}</span>
                <span className={`block text-[10.5px] ${ui.textFaint}`}>{s.at}</span>
              </span>
              {i < 2 ? <ChevronLeft className={`w-4 h-4 ${ui.textFaint} ${isRTL ? "rotate-180" : ""}`} /> : null}
            </div>
          ))}
          <p className={`text-[11px] ${ui.textSoft} leading-relaxed pt-1`}>{t.escalationSub}</p>
        </Card>

        <Button
          ui={ui}
          className="w-full h-13"
          // eslint-disable-next-line react-hooks/refs -- معالج حدث: تجربة الرنين
          onClick={() => triggerAlarm(activeAlarms[0] || alarms[0] || null, { demo: true })}
        >
          <Play className="w-4 h-4" />
          {t.tryRing}
        </Button>
        <p className={`text-[10.5px] ${ui.textFaint} text-center leading-relaxed`}>{t.duaSentence}</p>
      </div>
    </div>
  );

  /* ═══════════════════════ شاشة: الإعدادات ═══════════════════════ */
  const renderSettings = () => (
    <div className="absolute inset-0 overflow-y-auto app-scroll animate-screen-in">
      <div className="px-4 pt-4 pb-10">
        <h1 className={`text-[26px] font-black leading-tight ${ui.text}`}>{t.settingsScreenTitle}</h1>

        <SectionTitle ui={ui}>{t.profileSection}</SectionTitle>
        <Card ui={ui} className="p-4">
          <label className={`text-[11px] font-bold ${ui.textFaint} flex items-center gap-1.5 mb-2`}>
            <User className="w-3.5 h-3.5" />
            {t.yourName}
          </label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder={t.namePlaceholder}
            className={`w-full h-12 px-4 rounded-2xl border text-[14px] outline-none transition ${ui.input} ${ui.text}`}
          />
          <p className={`text-[11px] ${ui.textFaint} mt-2`}>
            {t.willWake} <b className={ui.accentText}>{displayName}</b>
          </p>
        </Card>

        <SectionTitle ui={ui}>{t.generalSection}</SectionTitle>
        <Card ui={ui} className={`${ui.divide} divide-y overflow-hidden`}>
          <Row
            ui={ui}
            icon={<Globe className="w-4 h-4" />}
            title={t.language}
            subtitle={language === "ar" ? "العربية (RTL)" : "English (LTR)"}
            right={
              <div className="flex gap-1.5">
                <Chip ui={ui} active={language === "ar"} onClick={() => setLanguage("ar")} className="h-9 px-3">عربي</Chip>
                <Chip ui={ui} active={language === "en"} onClick={() => setLanguage("en")} className="h-9 px-3">EN</Chip>
              </div>
            }
          />
          <Row
            ui={ui}
            icon={<Moon className="w-4 h-4" />}
            title={t.theme}
            subtitle={isDark ? t.dark : t.light}
            right={<Switch checked={isDark} onChange={(v) => setTheme(v ? "dark" : "light")} ui={ui} rtl={isRTL} size="sm" />}
          />
        </Card>

        <SectionTitle ui={ui}>{t.soundSection}</SectionTitle>
        <Card ui={ui} className={`${ui.divide} divide-y overflow-hidden`}>
          <Row
            ui={ui}
            icon={<Timer className="w-4 h-4" />}
            title={t.fastMode}
            subtitle={t.fastModeDesc}
            right={<Switch checked={fastMode} onChange={setFastMode} ui={ui} rtl={isRTL} size="sm" />}
          />
          <Row
            ui={ui}
            icon={isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            title={language === "ar" ? "كتم الصوت" : "Mute sound"}
            subtitle={language === "ar" ? "للتجربة بدون إزعاج - لا يُنصح به" : "For silent testing - not recommended"}
            right={<Switch checked={isMuted} onChange={setIsMuted} ui={ui} rtl={isRTL} size="sm" />}
          />
        </Card>

        <SectionTitle ui={ui}>{t.permTitle}</SectionTitle>
        <Card ui={ui} className="p-4">
          <PermissionsPanel t={t as unknown as Record<string, string>} dark={isDark} rtl={isRTL} />
        </Card>

        <SectionTitle ui={ui}>{t.installSection}</SectionTitle>
        <Card ui={ui} className="p-4 space-y-3">
          {isNativeApp ? (
            <div className={`p-3.5 rounded-2xl border ${ui.accentSoft} flex items-center gap-3`}>
              <span className="w-9 h-9 rounded-2xl bg-emerald-500 text-black flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-[12.5px] font-black ${ui.text}`}>{t.nativeRunningTitle}</span>
                <span className={`block text-[11px] ${ui.textFaint} mt-0.5 leading-snug`}>{t.nativeRunningDesc}</span>
              </span>
            </div>
          ) : (
            <>
              <Button ui={ui} className="w-full h-12" onClick={() => void handleInstallApp()}>
                {installStep === "installing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                {installStep === "success" ? t.installedSuccess : isInstalled ? t.installedBtn : t.installNowBtn}
              </Button>
              {isAndroidDevice() ? (
                <Button ui={ui} variant="ghost" className="w-full h-12" onClick={() => openNativeAppOr(() => void handleDownloadAPK())}>
                  <Download className="w-4 h-4" />
                  {t.openAppBtn}
                </Button>
              ) : null}
              <Button ui={ui} variant="ghost" className="w-full h-12" onClick={() => setShowInstallSheet(true)}>
                <Sparkles className="w-4 h-4" />
                {t.installOptions}
              </Button>
            </>
          )}
          <div className={`flex items-center gap-2 text-[10.5px] ${ui.textFaint}`}>
            <WifiOff className="w-3.5 h-3.5" />
            {t.worksWithoutNet} • {t.alarmWorksOffline}
          </div>
        </Card>

        <SectionTitle ui={ui}>{t.versionLabel}</SectionTitle>
        <Card ui={ui} className="p-4 flex items-center gap-3" soft>
          <span className={`w-9 h-9 rounded-2xl ${ui.cardSoft} border ${ui.border} flex items-center justify-center ${ui.textSoft}`}>
            <RotateCcw className="w-4 h-4" />
          </span>
          <span className="flex-1 min-w-0">
            <span className={`block text-[12.5px] font-bold ${ui.text}`}>v{APP_VERSION}</span>
            <span className={`block text-[10.5px] ${ui.textFaint}`}>
              {updateInfo ? `${t.appUpdated} ${updateInfo.version}` : t.autoUpdateDesc}
            </span>
          </span>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${ui.accentSoft} ${ui.accentText} border`}>
            {notificationPermission === "granted" ? t.perm_notifications : t.notInstalled}
          </span>
        </Card>
      </div>
    </div>
  );

  /* ═══════════════════════ شاشة: حول + اسم المطور ═══════════════════════ */
  const renderAbout = () => (
    <div className="absolute inset-0 overflow-y-auto app-scroll animate-screen-in">
      <div className="px-4 pt-4 pb-10">
        {/* هوية التطبيق */}
        <Card ui={ui} className="p-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-[26px] bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-[0_14px_40px_rgba(16,185,129,0.4)] mb-3">
            <span className="text-[36px] leading-none">🌙</span>
          </div>
          <h1 className={`text-[20px] font-black ${ui.text}`}>{t.appName}</h1>
          <p className={`text-[12px] ${ui.textFaint} mt-0.5`}>{t.appSub}</p>
          <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ui.accentSoft} ${ui.accentText}`}>
              v{APP_VERSION}
            </span>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ui.cardSoft} ${ui.border} ${ui.textSoft}`}>
              {t.appIdentityNote}
            </span>
            {isInstalled ? (
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500 text-black">{t.installedShort}</span>
            ) : null}
          </div>
          <p className={`text-[11.5px] ${ui.textSoft} mt-4 leading-relaxed px-1`}>{t.duaSentence}</p>
        </Card>

        <SectionTitle ui={ui}>{t.featuresTitle}</SectionTitle>
        <Card ui={ui} className={`overflow-hidden divide-y ${ui.divide}`}>
          {[
            { icon: <BellRing className="w-4 h-4" />, title: t.unlimitedAlarms, sub: t.alarmsScreenSub },
            { icon: <Repeat className="w-4 h-4" />, title: t.repeatDaily, sub: t.alarmWillRingDaily },
            { icon: <User className="w-4 h-4" />, title: t.featureName, sub: t.maleVoiceDesc },
            { icon: <Volume2 className="w-4 h-4" />, title: t.featureEscalate, sub: t.escalationSub },
            { icon: <Camera className="w-4 h-4" />, title: t.featureCamera, sub: t.aiPowered },
            { icon: <WifiOff className="w-4 h-4" />, title: t.feature2, sub: t.alarmWorksAfterCloseDesc },
            { icon: <Lock className="w-4 h-4" />, title: t.alarmPersistentTitle, sub: t.alarmPersistentDesc },
            { icon: <ShieldCheck className="w-4 h-4" />, title: t.permTitle, sub: t.permNote },
            { icon: <Globe className="w-4 h-4" />, title: `${t.language}: ${language === "ar" ? "العربية / English" : "English / العربية"}`, sub: `${t.theme}: ${t.dark} / ${t.light}` },
          ].map((f, i) => (
            <Row key={i} ui={ui} icon={f.icon} title={f.title} subtitle={f.sub} />
          ))}
        </Card>

        {/* اسم المطور - في آخر التطبيق */}
        <div className="mt-6">
          <Card ui={ui} className="p-5 text-center relative overflow-hidden">
            <div className="absolute -top-12 -start-12 w-36 h-36 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            <p className={`text-[10.5px] font-black tracking-[0.2em] ${ui.textFaint} uppercase`}>{t.developerRole}</p>
            <p className={`text-[19px] font-black mt-1.5 ${ui.text}`} dir="ltr">
              {DEVELOPER_NAME}
            </p>
            <p className={`text-[11px] ${ui.accentText} mt-1 font-bold`}>
              {t.developerLabel}: <span dir="ltr">{DEVELOPER_NAME}</span>
            </p>
            <div className={`mt-4 pt-4 border-t ${ui.border} flex items-center justify-center gap-1.5`}>
              <Heart className="w-3.5 h-3.5 text-red-400" />
              <p className={`text-[10.5px] ${ui.textFaint}`}>{t.footerWorld}</p>
            </div>
            <p className={`text-[10px] ${ui.textFaint} mt-2`}>
              © {new Date().getFullYear()} {t.appName} • {t.rightsReserved}
            </p>
            <p className={`text-[10px] ${ui.textFaint} mt-1`} dir="ltr">
              Developed by {DEVELOPER_NAME}
            </p>
          </Card>
        </div>

        {/* مشاركة/تحميل */}
        <Card ui={ui} className="p-4 mt-4 flex items-center gap-4" soft>
          <div className="bg-white p-2 rounded-2xl shrink-0">
            <QRCode value={siteUrl} size={72} />
          </div>
          <div className="min-w-0">
            <p className={`text-[12px] font-black ${ui.text}`}>{t.scanToDownload}</p>
            <p className={`text-[10.5px] ${ui.textFaint} mt-1 leading-relaxed`}>{t.downloadSectionDesc}</p>
          </div>
        </Card>

        {/* آخر سطر في التطبيق: اسم المطور */}
        <p className={`text-center text-[11px] font-bold ${ui.textSoft} mt-6`} dir="ltr">
          {DEVELOPER_NAME}
        </p>
        <p className={`text-center text-[10px] ${ui.textFaint} mt-1`}>
          {language === "ar" ? "تطوير" : "Developed by"}: <span dir="ltr">{DEVELOPER_NAME}</span>
        </p>
      </div>
    </div>
  );

  /* ═══════════════════════ شاشة الرنين (فوق كل شيء) ═══════════════════════ */
  const renderRinging = () => {
    const stage = alarmStage;
    const tone =
      stage === "extreme"
        ? "from-red-950 via-[#1a0605] to-black"
        : stage === "annoying"
          ? "from-amber-950 via-[#1a1204] to-black"
          : stage === "verification"
            ? "from-[#06130f] via-[#04100e] to-black"
            : stage === "completed"
              ? "from-emerald-950 via-[#04100e] to-black"
              : "from-emerald-950 via-[#04100e] to-black";
    const shake = stage === "extreme" ? "animate-shake-intense" : stage === "annoying" ? "animate-shake" : "";

    return (
      <div className={`absolute inset-0 z-[80] bg-gradient-to-b ${tone} text-white overflow-y-auto app-scroll ${shake}`}>
        {/* شريط علوي صغير */}
        <div className="flex items-center gap-2 px-4 pt-4">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <p className="text-[11px] font-black text-white/80">
            {stage === "verification" ? t.proveWake : ringingAlarm?.label || t.appNameShort}
          </p>
          <span className="ms-auto text-[11px] font-mono tabular-nums text-white/60">
            {stage === "completed" ? "" : `${t.ringingSince} ${formatTimeSince(timeSinceRinging)}`}
          </span>
        </div>

        {stage === "ringing" || stage === "annoying" || stage === "extreme" ? (
          <div className="px-5 pt-8 pb-10 flex flex-col items-center text-center min-h-full">
            <div className="relative mb-6">
              <div
                className={`absolute inset-0 rounded-full animate-ping ${
                  stage === "extreme" ? "bg-red-500/25" : stage === "annoying" ? "bg-amber-500/25" : "bg-emerald-500/25"
                }`}
              />
              <div
                className={`relative w-28 h-28 rounded-full flex items-center justify-center border-2 shadow-2xl ${
                  stage === "extreme"
                    ? "bg-red-500 border-red-300 text-white"
                    : stage === "annoying"
                      ? "bg-amber-400 border-amber-200 text-black"
                      : "bg-emerald-500 border-emerald-300 text-black"
                }`}
              >
                <BellRing className={`w-14 h-14 ${stage === "ringing" ? "animate-pulse" : "animate-shake"}`} />
              </div>
            </div>

            <p className="text-[13px] font-bold text-white/60 mb-1">
              {ringingAlarm?.time ? <span dir="ltr" className="font-mono">{ringingAlarm.time}</span> : null}
              {ringingAlarm?.label ? ` • ${ringingAlarm.label}` : ""}
            </p>
            <h2 className="text-[26px] font-black leading-tight">
              {stage === "ringing" && `${t.wakeUpName} ${displayName}!`}
              {stage === "annoying" && `${t.getUpNow} ${displayName}!`}
              {stage === "extreme" && t.wakeNow}
            </h2>
            <p className="text-[12.5px] text-white/70 mt-1.5">
              {stage === "ringing" && t.fajrTime}
              {stage === "annoying" && t.annoyingBell}
              {stage === "extreme" && t.nightmare}
            </p>

            <div className="flex items-center justify-center gap-1 my-6 h-8">
              {[...Array(14)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full ${
                    stage === "extreme" ? "bg-red-400" : stage === "annoying" ? "bg-amber-300" : "bg-emerald-400"
                  }`}
                  style={{
                    height: `${25 + Math.random() * 70}%`,
                    animation: `pulse ${0.3 + Math.random() * 0.5}s ease-in-out infinite`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>

            <div className="w-full max-w-sm space-y-2.5 mt-auto">
              <div className="p-2 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3 text-red-300" />
                <span className="text-[10px] font-black text-red-200">{t.cannotClose}</span>
                <span className="text-[9.5px] text-red-200/70">• {t.willNotStop}</span>
              </div>
              <Progress
                ui={ui}
                tone={stage === "extreme" ? "danger" : stage === "annoying" ? "warn" : "accent"}
                value={Math.min(100, (timeSinceRinging / (fastMode ? 30 : 600)) * 100)}
              />
              <button
                onClick={() => {
                  haptic(20);
                  handleWakeUp();
                }}
                className="w-full h-14 rounded-full bg-white text-black font-black text-[15px] shadow-xl active:scale-95 transition flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                {t.wokeUp}
              </button>
              <div className="relative">
                <button
                  onMouseDown={handleSnoozeHoldStart}
                  onMouseUp={handleSnoozeHoldEnd}
                  onTouchStart={handleSnoozeHoldStart}
                  onTouchEnd={handleSnoozeHoldEnd}
                  onMouseLeave={handleSnoozeHoldEnd}
                  disabled={snoozeCount >= 1}
                  className={`w-full h-12 rounded-full text-[12.5px] font-bold transition relative overflow-hidden flex items-center justify-center gap-2 ${
                    snoozeCount >= 1 ? "bg-red-500/20 text-red-200 border border-red-500/30" : "glass text-white/85 border border-white/15"
                  }`}
                >
                  {snoozeCount >= 1 ? t.snoozeUsed : isHoldingSnooze ? `${Math.round(snoozeHoldProgress)}%` : `${t.snooze} ${fastMode ? `10 ${t.sec}` : `5 ${t.min}`} 💤`}
                  {isHoldingSnooze ? (
                    <span className="absolute bottom-0 left-0 h-1 bg-emerald-400" style={{ width: `${snoozeHoldProgress}%` }} />
                  ) : null}
                </button>
                {snoozeCount < 1 ? <p className="text-[9.5px] text-white/45 text-center mt-1.5">{t.holdToSnooze}</p> : null}
              </div>
              <p className="text-[9.5px] text-white/40 text-center">{t.notificationWillReturn}</p>
            </div>
          </div>
        ) : null}

        {stage === "verification" ? (
          <div className="px-4 pt-3 pb-8">
            <div className="mb-3 p-2.5 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 animate-pulse">
              <Volume2 className="w-4 h-4 text-red-300" />
              <p className="text-[10.5px] text-red-100 font-black">{t.verificationSoundOn}</p>
              <div className="ms-auto flex gap-0.5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-0.5 h-3.5 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </div>

            <div className="flex gap-1.5 mb-3">
              {verificationTasks.map((task, i) => (
                <div
                  key={task.id}
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    i < currentVerificationIndex ? "bg-emerald-400" : i === currentVerificationIndex ? "bg-white animate-pulse" : "bg-white/20"
                  }`}
                />
              ))}
            </div>

            <Card ui={ui} className="p-3.5 bg-white/[0.04] border-white/10">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-black flex items-center justify-center shrink-0">
                  {verificationTasks[currentVerificationIndex]?.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-white flex items-center gap-1.5 flex-wrap">
                    {verificationTasks[currentVerificationIndex]?.title}
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-500/25">
                      🤖 {t.aiPowered}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                      {currentVerificationIndex + 1}/3
                    </span>
                  </p>
                  <p className="text-[11px] text-white/60 mt-1 leading-relaxed">{verificationTasks[currentVerificationIndex]?.subtitle}</p>
                </div>
              </div>

              <div className="mt-3">
                {cameraPermissionError ? (
                  <div className="aspect-[4/3] rounded-2xl bg-red-950/40 border-2 border-red-500/30 flex flex-col items-center justify-center gap-3 p-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-red-300" />
                    </div>
                    <div>
                      <p className="text-[12.5px] font-black text-red-100">
                        {cameraErrorCode === "busy" ? t.cameraBusy : cameraErrorCode === "missing" || cameraErrorCode === "unsupported" ? t.cameraMissing : t.cameraDenied}
                      </p>
                      <p className="text-[10.5px] text-white/55 mt-1 leading-relaxed">
                        {cameraErrorCode === "busy" ? t.cameraBusyDesc : cameraErrorCode === "missing" || cameraErrorCode === "unsupported" ? t.cameraMissingDesc : t.cameraDeniedDesc}
                      </p>
                      {(cameraErrorCode === "denied" || cameraErrorCode === "") && (
                        <p className="text-[10px] text-amber-200/80 mt-1.5 leading-relaxed">{t.cameraDeniedHint}</p>
                      )}
                    </div>
                    <button
                      // eslint-disable-next-line react-hooks/refs -- معالج حدث: فتح الكاميرا
                      onClick={() => void openCamera(verificationTasks[currentVerificationIndex]?.id)}
                      className="px-4 h-10 rounded-full bg-red-500 text-white font-black text-[11.5px] flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {cameraErrorCode === "denied" || cameraErrorCode === "" ? t.allowCamera : t.cameraRetry}
                    </button>
                  </div>
                ) : !isCameraOpen && !capturedImage ? (
                  <div className="aspect-[4/3] rounded-2xl bg-black/50 border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-2 p-4">
                    <div className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-white/40" />
                    </div>
                    <p className="text-[11px] text-white/50 text-center">
                      {language === "ar" ? "صور" : "Photograph"} {verificationTasks[currentVerificationIndex]?.title}
                    </p>
                    <p className="text-[9.5px] text-emerald-300/70 text-center px-2">
                      {verificationTasks[currentVerificationIndex]?.id === "water" && t.aimWater}
                      {verificationTasks[currentVerificationIndex]?.id === "prayer" && t.aimPrayer}
                      {verificationTasks[currentVerificationIndex]?.id === "face" && t.aimFace}
                    </p>
                    <button
                      onClick={() => void openCamera(verificationTasks[currentVerificationIndex]?.id)}
                      className="mt-1 px-4 h-10 rounded-full bg-white text-black font-black text-[11.5px] flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {t.tapToOpenCamera}
                    </button>
                    <label className="text-[10px] text-emerald-300 underline cursor-pointer">
                      {t.uploadFromGallery}
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                ) : isCameraOpen && !capturedImage ? (
                  <div className="space-y-2">
                    <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-black relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={{ transform: verificationTasks[currentVerificationIndex]?.id === "face" ? "scaleX(-1)" : "none" }}
                      />
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0 border-2 border-emerald-400/50 rounded-2xl" />
                        <div className="absolute top-2 start-2 text-[9px] px-2 py-1 rounded-full bg-black/65 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          {verificationTasks[currentVerificationIndex]?.id === "water" && t.aiCheckingWater}
                          {verificationTasks[currentVerificationIndex]?.id === "prayer" && t.aiCheckingPrayer}
                          {verificationTasks[currentVerificationIndex]?.id === "face" && t.aiCheckingFace}
                        </div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24">
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white rounded-tl-lg" />
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white rounded-tr-lg" />
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white rounded-bl-lg" />
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white rounded-br-lg" />
                        </div>
                      </div>
                      <div className="absolute bottom-2 start-2 end-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/85 text-white text-[9px] font-black">
                          <Volume2 className="w-3 h-3 animate-pulse" />
                          {language === "ar" ? "الصوت مستمر 🔊" : "Sound ON 🔊"}
                        </span>
                        <span className="flex items-center gap-2">
                          {cameraStreamActive ? (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/65 text-white text-[9px] font-black">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              {language === "ar" ? "الكاميرا تعمل" : "CAM LIVE"}
                            </span>
                          ) : null}
                          <span className="flex gap-0.5">
                            {[...Array(4)].map((_, i) => (
                              <span key={i} className="w-0.5 h-2.5 bg-white rounded-full animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                            ))}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={capturePhoto}
                        className="h-11 rounded-full bg-white text-black font-black text-[12px] flex items-center justify-center gap-2 shadow-lg"
                      >
                        <span className="w-4 h-4 rounded-full border-2 border-black flex items-center justify-center">
                          <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                        </span>
                        {t.capture}
                      </button>
                      <button
                        onClick={() => {
                          if (streamRef.current) streamRef.current.getTracks().forEach((x) => x.stop());
                          setIsCameraOpen(false);
                          setCameraStreamActive(false);
                        }}
                        className="h-11 rounded-full glass border border-white/20 font-bold text-[12px] text-white"
                      >
                        {t.cancel}
                      </button>
                    </div>
                    <p className="text-[9.5px] text-white/40 text-center">{t.directOnly}</p>
                  </div>
                ) : capturedImage ? (
                  <div className="space-y-2">
                    <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-black relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={capturedImage} alt="captured" className="w-full h-full object-cover" />
                      {aiAnalyzing ? (
                        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-3">
                          <div className="w-11 h-11 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                          <p className="text-[12px] text-emerald-300 font-black animate-pulse">{t.aiAnalyzing}</p>
                        </div>
                      ) : null}
                      {aiResult ? (
                        <div className={`absolute bottom-0 inset-x-0 p-2.5 backdrop-blur ${aiResult.valid ? "bg-emerald-500/90" : "bg-red-500/90"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-black text-white flex items-center gap-1">
                              {aiResult.valid ? "✓" : "✗"} {aiResult.message}
                            </p>
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-black/25 text-white shrink-0">
                              {t.aiConfidence}: {aiResult.confidence}%
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        disabled={aiAnalyzing}
                        onClick={() => {
                          if (aiResult && !aiResult.valid) {
                            if (aiResult.confidence >= 30 || verificationAttempts >= 2) confirmCapture(true);
                            else {
                              setAiResult(null);
                              void confirmCapture(false);
                            }
                          } else {
                            void confirmCapture(false);
                          }
                        }}
                        className={`h-11 rounded-full text-[11.5px] font-black flex items-center justify-center gap-1.5 transition ${
                          aiAnalyzing
                            ? "bg-white/20 text-white/50"
                            : aiResult && !aiResult.valid
                              ? aiResult.confidence >= 30 || verificationAttempts >= 2
                                ? "bg-emerald-500 text-black"
                                : "bg-amber-400 text-black"
                              : "bg-emerald-500 text-black"
                        }`}
                      >
                        {aiAnalyzing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {t.aiAnalyzing}
                          </>
                        ) : aiResult && !aiResult.valid ? (
                          aiResult.confidence >= 30 || verificationAttempts >= 2 ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              {language === "ar" ? "تأكيد على أي حال ✓" : "Confirm anyway ✓"}
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              {language === "ar" ? "حاول مرة أخرى" : "Try again"}
                            </>
                          )
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            {t.confirm} 🤖
                          </>
                        )}
                      </button>
                      <button
                        disabled={aiAnalyzing}
                        onClick={() => {
                          setCapturedImage(null);
                          setAiResult(null);
                          setAiAnalyzing(false);
                        }}
                        className="h-11 rounded-full glass border border-white/20 font-bold text-[11.5px] text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t.retake}
                      </button>
                    </div>
                    {aiResult && !aiResult.valid && aiResult.checks.length > 0 ? (
                      <div className="p-3 rounded-2xl bg-black/45 border border-white/10 space-y-2">
                        <div className="grid grid-cols-2 gap-1">
                          {aiResult.checks.map((c) => (
                            <div
                              key={c.id}
                              className={`flex items-center gap-1 px-1.5 py-1 rounded-lg text-[9px] font-bold ${
                                c.passed ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                              }`}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] shrink-0 ${
                                  c.passed ? "bg-emerald-500 text-black" : "bg-red-500 text-white"
                                }`}
                              >
                                {c.passed ? "✓" : "✕"}
                              </span>
                              {tr("cl_" + c.id)}
                            </div>
                          ))}
                        </div>
                        {aiResult.tips.length > 0 ? (
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            {aiResult.tips.map((tip) => (
                              <p key={tip} className="text-[10px] text-amber-200 leading-relaxed">
                                💡 {tr(tip)}
                              </p>
                            ))}
                          </div>
                        ) : null}
                        <p className="text-[9px] text-white/50 text-center">
                          {t.aiConfidence}: {aiResult.confidence}% • {tr("attemptsLabel")}: {verificationAttempts}
                          {(aiResult.confidence >= 30 || verificationAttempts >= 2) && ` • ${tr("canConfirmAnyway")}`}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Card>

            <div className="mt-3 space-y-2">
              {verificationTasks.slice(0, currentVerificationIndex).map((task) => (
                <div key={task.id} className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[11.5px] font-bold text-white">{task.title} ✓ 🤖</span>
                  <span className="ms-auto text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200">{t.done}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {stage === "completed" ? (
          <div className="px-5 pt-10 pb-10 flex flex-col items-center text-center min-h-full">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(16,185,129,0.45)]">
              <Check className="w-10 h-10 text-black" />
            </div>
            <h2 className="text-[21px] font-black">
              {t.mayAllahAccept} {displayName}! 🎉
            </h2>
            <p className="text-[12.5px] text-white/65 leading-relaxed mt-2">{t.wellDone}</p>
            <p className="text-[11px] text-emerald-200/70 mt-2 px-2 leading-relaxed">{t.nowPray}</p>

            <div className="grid grid-cols-3 gap-2 w-full max-w-sm my-5">
              {verificationTasks.map((task) => (
                <div key={task.id} className="glass rounded-2xl p-2 border border-white/10">
                  {task.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={task.image} alt="" className="w-full aspect-square rounded-xl object-cover mb-1.5" />
                  ) : (
                    <div className="w-full aspect-square rounded-xl bg-white/5 mb-1.5" />
                  )}
                  <p className="text-[9px] font-bold text-white truncate">{task.title}</p>
                  <p className="text-[8px] text-emerald-400">{t.done}</p>
                </div>
              ))}
            </div>

            <div className={`w-full max-w-sm p-3 rounded-2xl border ${ui.accentSoft} text-start`}>
              <p className="text-[11px] font-black text-emerald-200 flex items-center gap-1.5">
                <Repeat className="w-4 h-4" />
                {t.alarmWillRingDaily}
              </p>
              {next ? (
                <p className="text-[11px] text-emerald-100/80 mt-1.5">
                  {t.nextRing}: <b className="font-mono" dir="ltr">{String(next.at.getHours()).padStart(2, "0")}:{String(next.at.getMinutes()).padStart(2, "0")}</b>{" "}
                  {next.alarm.label ? `• ${next.alarm.label}` : ""} ({countdownText(now, next.at, language)})
                </p>
              ) : null}
            </div>

            <button
              onClick={() => {
                haptic(15);
                closeCompleted();
              }}
              className="w-full max-w-sm h-13 rounded-full bg-white text-black font-black text-[14px] mt-5 active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {t.done}
            </button>
            <p className="text-[9.5px] text-white/35 mt-3">{t.duaSentence}</p>
          </div>
        ) : null}
      </div>
    );
  };

  /* ═══════════════════════ الهيكل ═══════════════════════ */
  return (
    <div
      className={`app-bg min-h-dvh w-full flex items-center justify-center ${isDark ? "bg-[#020908]" : "bg-[#dde6e3]"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className={`app-frame ${ui.screen}`}>
        <AppBar
          appName={t.appName}
          appSub={t.appSub}
          ui={ui}
          rtl={isRTL}
          language={language}
          onToggleLanguage={() => setLanguage(language === "ar" ? "en" : "ar")}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          installed={isInstalled}
          installedLabel={t.installedShort}
          time={now}
        />

        <StatusStrip
          ui={ui}
          items={[
            {
              icon: <AlarmClock className="w-3 h-3" />,
              text: `${activeAlarms.length}/${alarms.length} ${t.alarmsCountWord}`,
              tone: activeAlarms.length > 0 ? "ok" : "warn",
            },
            { icon: <WifiOff className="w-3 h-3" />, text: t.worksOffline, tone: "muted" },
            { icon: <Repeat className="w-3 h-3" />, text: t.everyday, tone: "muted" },
            ...(isInstalled
              ? [{ icon: <Smartphone className="w-3 h-3" />, text: t.installedShort, tone: "ok" as const }]
              : [{ icon: <Download className="w-3 h-3" />, text: t.readyToInstall, tone: "warn" as const }]),
          ]}
        />

        <main className="relative flex-1 overflow-hidden">
          {tab === "alarms" ? renderAlarms() : null}
          {tab === "verify" ? renderVerify() : null}
          {tab === "settings" ? renderSettings() : null}
          {tab === "about" ? renderAbout() : null}

          {tab === "alarms" && alarmStage === "idle" ? <Fab onClick={openCreateSheet} label={t.addAlarm} rtl={isRTL} /> : null}

          {toast ? (
            <div className="absolute top-3 inset-x-4 z-[70] flex justify-center pointer-events-none">
              <div className="px-4 py-2.5 rounded-2xl bg-black/85 text-white text-[11.5px] font-bold shadow-xl border border-white/10 animate-pop backdrop-blur">
                {toast}
              </div>
            </div>
          ) : null}

          {updateInfo ? (
            <div className="absolute bottom-4 inset-x-4 z-[70]">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-xl flex items-center gap-3 animate-pop">
                <RotateCcw className="w-5 h-5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11.5px] font-black">
                    {t.appUpdated} <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-white/20">v{updateInfo.version}</span>
                  </p>
                  <p className="text-[10.5px] opacity-90 truncate">{updateInfo.message}</p>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="h-8 px-3 rounded-full bg-white text-indigo-700 text-[10.5px] font-black shrink-0"
                >
                  {t.refreshNow}
                </button>
                <button
                  onClick={() => {
                    setUpdateInfo(null);
                    try {
                      localStorage.removeItem("hatsally-update-pending");
                    } catch {
                      /* تجاهل */
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0"
                  aria-label="close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : null}
        </main>

        <TabBar
          tabs={tabs}
          active={tab}
          onChange={(id) => setTab(id)}
          ui={ui}
          rtl={isRTL}
          badge={{ alarms: alarms.filter((a) => a.enabled).length }}
        />

        {/* شاشة البداية: تغطي التطبيق حتى تُقرأ المنبهات المحفوظة (بلا وميض) */}
        {!booted ? (
          <div className={`absolute inset-0 z-[95] flex flex-col items-center justify-center gap-3 ${ui.screen}`}>
            <div className="w-20 h-20 rounded-[26px] bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-[0_14px_40px_rgba(16,185,129,0.4)] animate-pulse-glow">
              <span className="text-[36px] leading-none">🌙</span>
            </div>
            <p className={`text-[16px] font-black ${ui.text}`}>{t.appName}</p>
            <p className={`text-[11px] ${ui.textFaint}`}>{t.appSub}</p>
            <Loader2 className={`w-5 h-5 animate-spin ${ui.accentText} mt-2`} />
          </div>
        ) : null}

        {/* شاشة الرنين فوق كل شيء */}
        {alarmStage !== "idle" ? renderRinging() : null}

        {/* لوح إضافة/تعديل منبه - يُركَّب من جديد عند كل فتح */}
        {sheet ? (
          <AlarmSheet
            key={`${sheet.mode}-${sheet.alarm?.id || "new"}`}
            open
            mode={sheet.mode}
            initial={
              sheet.alarm
                ? {
                    label: sheet.alarm.label,
                    time: sheet.alarm.time,
                    days: sheet.alarm.days,
                    durationDays: sheet.alarm.durationDays,
                    startDate: sheet.alarm.startDate,
                    enabled: sheet.alarm.enabled,
                  }
                : defaultAlarm({ label: "", time: "05:00", enabled: true })
            }
            ui={ui}
            rtl={isRTL}
            language={language}
            t={t}
            onClose={() => setSheet(null)}
            onSave={(draft) => void commitAlarm(draft, sheet.mode === "edit" ? sheet.alarm?.id : undefined)}
            onDelete={sheet.mode === "edit" && sheet.alarm ? () => setConfirmDelete(sheet.alarm) : undefined}
          />
        ) : null}

        {/* تأكيد الحذف */}
        <Sheet open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} ui={ui} rtl={isRTL} title={t.deleteAlarmConfirm} subtitle={t.deleteAlarmDesc}>
          <div className="pb-2">
            <Card ui={ui} soft className="p-4 flex items-center gap-3">
              <span className="text-[26px] font-black tabular-nums" dir="ltr">
                {confirmDelete?.time}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-[12px] font-bold ${ui.text} truncate`}>{confirmDelete?.label || t.navAlarms}</span>
                <span className={`block text-[10.5px] ${ui.textFaint}`}>
                  {confirmDelete ? `${repeatSummary(confirmDelete, t, language)} • ${durationSummary(confirmDelete, t)}` : ""}
                </span>
              </span>
              <Hourglass className={`w-4 h-4 ${ui.textFaint}`} />
            </Card>
            <div className="flex gap-2 mt-4">
              <Button ui={ui} variant="ghost" className="flex-1 h-12" onClick={() => setConfirmDelete(null)}>
                {t.cancel}
              </Button>
              <Button ui={ui} variant="danger" className="flex-1 h-12" onClick={() => confirmDelete && deleteAlarmById(confirmDelete.id)}>
                <X className="w-4 h-4" />
                {t.deleteWord}
              </Button>
            </div>
          </div>
        </Sheet>

        {/* معالج الأذونات */}
        <Sheet
          open={showPermWizard}
          onClose={() => {
            setShowPermWizard(false);
            setPendingEnableId(null);
          }}
          ui={ui}
          rtl={isRTL}
          title={t.permWizardTitle}
          subtitle={t.permWizardDesc}
          footer={
            <div className="flex gap-2">
              <Button
                ui={ui}
                variant="ghost"
                className="flex-1 h-12"
                onClick={() => {
                  setShowPermWizard(false);
                  setPendingEnableId(null);
                }}
              >
                {t.permWizardLater}
              </Button>
              <Button
                ui={ui}
                disabled={permChecking}
                className="flex-1 h-12"
                onClick={async () => {
                  setPermChecking(true);
                  try {
                    const crit = await checkCritical();
                    if (crit.ok) {
                      const id = pendingEnableId;
                      setShowPermWizard(false);
                      setPendingEnableId(null);
                      if (id) armAlarmById(id);
                    } else {
                      showToast(t.permNeededForAlarm);
                    }
                  } finally {
                    setPermChecking(false);
                  }
                }}
              >
                {permChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {t.permWizardActivate}
              </Button>
            </div>
          }
        >
          <div className="pb-2">
            <PermissionsPanel t={t as unknown as Record<string, string>} dark={isDark} rtl={isRTL} />
          </div>
        </Sheet>

        {/* لوح التثبيت / تحميل APK */}
        <Sheet
          open={showInstallSheet}
          onClose={() => setShowInstallSheet(false)}
          ui={ui}
          rtl={isRTL}
          title={apkDownloading || apkDownloaded || apkError ? t.apkOptionTitle : t.downloadModalTitle}
          subtitle={t.downloadModalDesc}
        >
          <div className="space-y-3 pb-2">
            {apkDownloading ? (
              <Card ui={ui} soft className="p-4">
                <p className={`text-[12px] font-black ${ui.text} mb-2`}>{t.apkDownloading}</p>
                <Progress ui={ui} value={apkProgress} />
                <p className={`text-[12px] font-black ${ui.accentText} mt-2`}>{apkProgress}%</p>
                {apkInfo?.available ? (
                  <p className={`text-[10.5px] ${ui.textFaint}`}>
                    {t.apkVersion}: {apkInfo.version} • {t.apkSize}: {apkInfo.sizeLabel}
                  </p>
                ) : null}
              </Card>
            ) : null}

            {apkDownloaded ? (
              <Card ui={ui} soft className="p-4 space-y-2.5">
                <p className={`text-[12.5px] font-black ${ui.text}`}>{t.apkDownloadedTitle}</p>
                <p className={`text-[11px] ${ui.textSoft}`}>{t.apkDownloadedDesc}</p>
                {[
                  { n: "1", title: t.apkStep1Title, desc: t.apkStep1Desc },
                  { n: "2", title: t.apkStep2Title, desc: t.apkStep2Desc },
                  { n: "3", title: t.apkStep3Title, desc: t.apkStep3Desc },
                ].map((s) => (
                  <div key={s.n} className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-emerald-500 text-black font-black text-[11px] flex items-center justify-center shrink-0">{s.n}</span>
                    <span>
                      <span className={`block text-[11.5px] font-bold ${ui.text}`}>{s.title}</span>
                      <span className={`block text-[10.5px] ${ui.textFaint}`}>{s.desc}</span>
                    </span>
                  </div>
                ))}
              </Card>
            ) : null}

            {apkError ? (
              <Card ui={ui} soft className="p-4 space-y-2">
                <p className="text-[12px] font-black text-red-400">{apkError}</p>
                {(!apkInfo || !apkInfo.available) && <p className={`text-[10.5px] ${ui.textFaint}`}>{t.apkPreparing}</p>}
                <Button ui={ui} className="w-full h-11" onClick={() => void handleDownloadAPK()}>
                  <RotateCcw className="w-4 h-4" />
                  {t.apkRetry}
                </Button>
                <a
                  href={apkInfo?.releaseUrl || APK_RELEASE_URL}
                  className={`w-full h-11 rounded-2xl border ${ui.border} ${ui.cardSoft} ${ui.text} text-[12px] font-bold flex items-center justify-center gap-2`}
                >
                  <Download className="w-4 h-4" />
                  {t.apkReleaseLink}
                </a>
              </Card>
            ) : null}

            {!apkDownloading && !apkDownloaded && !apkError ? (
              <>
                {isNativeApp ? (
                  <Card ui={ui} soft className="p-4 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-2xl bg-emerald-500 text-black flex items-center justify-center shrink-0">
                      <Check className="w-5 h-5" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[12.5px] font-black ${ui.text}`}>{t.nativeRunningTitle}</span>
                      <span className={`block text-[10.5px] ${ui.textFaint} leading-snug`}>{t.nativeRunningDesc}</span>
                    </span>
                  </Card>
                ) : null}

                {!isNativeApp && !isIosDevice() ? (
                  <button
                    onClick={() => void handleDownloadAPK()}
                    className="w-full rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 text-black font-black p-4 shadow-lg active:scale-[0.99] transition"
                  >
                    <span className="flex items-center justify-center gap-2 text-[13.5px]">
                      <Download className="w-5 h-5" />
                      {t.apkOptionTitle}
                      <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-black/15">APK</span>
                    </span>
                    <span className="block text-[11px] font-bold opacity-80 mt-1">{t.apkOptionDesc}</span>
                    <span className="block text-[10px] opacity-70 mt-0.5">
                      {apkInfo?.available ? `${t.apkVersion}: ${apkInfo.version} • ${t.apkSize}: ${apkInfo.sizeLabel}` : t.apkBuildStatus}
                    </span>
                  </button>
                ) : null}

                {!isNativeApp ? (
                  <>
                    <div className="flex items-center gap-3 opacity-60">
                      <span className={`flex-1 h-px ${ui.track}`} />
                      <span className={`text-[10.5px] ${ui.textFaint}`}>{t.orDivider}</span>
                      <span className={`flex-1 h-px ${ui.track}`} />
                    </div>
                    <Button ui={ui} variant="ghost" className="w-full h-13" onClick={() => void handleInstallApp()}>
                      {installStep === "installing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                      {t.pwaOptionTitle}
                    </Button>
                    <p className={`text-[10.5px] ${ui.textFaint} text-center`}>{t.pwaOptionDesc}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Card ui={ui} soft className="p-3">
                        <p className={`text-[11.5px] font-black ${ui.text} flex items-center gap-1`}>🤖 {t.android}</p>
                        <p className={`text-[10px] ${ui.textFaint} mt-1 leading-relaxed`}>{t.androidDesc}</p>
                      </Card>
                      <Card ui={ui} soft className="p-3">
                        <p className={`text-[11.5px] font-black ${ui.text} flex items-center gap-1`}>🍎 {t.iphone}</p>
                        <p className={`text-[10px] ${ui.textFaint} mt-1 leading-relaxed`}>{t.iphoneDesc}</p>
                      </Card>
                    </div>
                    <div className="flex justify-center">
                      <div className="bg-white p-2 rounded-2xl">
                        <QRCode value={siteUrl} size={84} />
                      </div>
                    </div>
                    <p className={`text-[10px] ${ui.textFaint} text-center`}>{t.scanToDownload}</p>
                  </>
                ) : null}

                <p className={`text-[10.5px] ${ui.textFaint} text-center flex items-center justify-center gap-1.5 pt-1`}>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {t.safe}
                </p>
              </>
            ) : null}

            <p className={`text-[10.5px] ${ui.textSoft} text-center leading-relaxed flex items-center justify-center gap-1`}>
              <Heart className="w-3 h-3 text-red-400 shrink-0" />
              {t.duaSentence}
            </p>
            <p className={`text-[10px] ${ui.textFaint} text-center`} dir="ltr">
              {t.developerLabel}: {DEVELOPER_NAME}
            </p>
          </div>
        </Sheet>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
