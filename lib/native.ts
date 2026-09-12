/**
 * الجسر الأصلي لتطبيق هتصلي (Native Bridge)
 * ---------------------------------------------------------------
 * هذا الملف هو الوصلة بين واجهة الويب وقدرات الهاتف الأصلية داخل
 * ملف الـ APK المبني بـ Capacitor:
 *  - النطق بتحويل النص لكلام عبر محرك الهاتف (TTS) ليناديك باسمك
 *  - جدولة تنبيهات محلية دقيقة لوقت المنبه حتى لو التطبيق مغلق
 *  - كشف بيئة التشغيل (APK أصلي / متصفح / iOS / أندرويد)
 *  - تحميل ملف الـ APK الحقيقي مع نسبة التقدم
 *
 * على المتصفح العادي كل الدوال تُرجع false بأمان ويعمل بديل الويب.
 */

import { Capacitor } from "@capacitor/core";

/** هل نعمل داخل تطبيق APK أصلي؟ */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** المنصة: android | ios | web */
export function getNativePlatform(): "android" | "ios" | "web" {
  try {
    const p = Capacitor.getPlatform();
    if (p === "android" || p === "ios") return p;
    return "web";
  } catch {
    return "web";
  }
}

/** هل الجهاز أندرويد (APK أو متصفح)؟ */
export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (getNativePlatform() === "android") return true;
  return /android/i.test(navigator.userAgent || "");
}

/** هل الجهاز آيفون؟ (لا يدعم APK) */
export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (getNativePlatform() === "ios") return true;
  return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
}

// ------------------------------------------------------------------
// النطق الصوتي الأصلي (TTS) - يناديك باسمك بصوت رجل داخل الـ APK
// متصفح WebView لا يدعم speechSynthesis لذلك هذا ضروري في التطبيق.
// ------------------------------------------------------------------
export async function nativeSpeak(
  text: string,
  opts: { lang?: string; rate?: number; pitch?: number } = {}
): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
    const lang = opts.lang || "ar-SA";

    // اختيار صوت رجل عربي إن وُجد
    let voiceName: string | undefined;
    try {
      const { voices } = await TextToSpeech.getSupportedVoices();
      const list = (voices || []) as Array<{ name?: string; lang?: string }>;
      const langCode = lang.slice(0, 2).toLowerCase();
      const langVoices = list.filter((v) =>
        (v.lang || "").toLowerCase().startsWith(langCode)
      );
      const pool = langVoices.length > 0 ? langVoices : list;
      const male = pool.find((v) => {
        const n = (v.name || "").toLowerCase();
        const maleHint =
          /male|maged|majed|majid|naayf|nayef|naif|tarik|tariq|omar|ahmed|ahmad|mohamed|khalid|abdullah|youssef|david|daniel|mark|alex|john/i.test(
            n
          );
        const femaleHint = /female|woman|sara|laila|zara|samantha/i.test(n);
        return maleHint && !femaleHint;
      });
      const nonFemale =
        male ||
        pool.find((v) => {
          const n = (v.name || "").toLowerCase();
          return !/female|woman|sara|laila|zara|samantha/i.test(n);
        });
      voiceName = (nonFemale || pool[0])?.name;
      if (voiceName) console.log("🎙️ [Native TTS] using voice:", voiceName);
    } catch {
      /* تجاهل - سيستخدم الصوت الافتراضي */
    }

    try {
      await TextToSpeech.stop();
    } catch {
      /* لا شيء يعمل */
    }
    await TextToSpeech.speak({
      text,
      lang,
      // محرك الأندرويد: rate الطبيعي 1.0 و pitch الطبيعي 1.0
      rate: opts.rate ?? 0.92,
      pitch: opts.pitch ?? 0.7,
      volume: 1.0,
      voice: voiceName,
      category: "alarm",
    } as never);
    return true;
  } catch (e) {
    console.warn("[Native TTS] failed:", e);
    return false;
  }
}

/** إيقاف النطق الأصلي */
export async function stopNativeSpeech(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
    await TextToSpeech.stop();
  } catch {
    /* تجاهل */
  }
}

// ------------------------------------------------------------------
// التنبيهات المحلية الأصلية - المنبه يعمل حتى لو التطبيق مغلق
// ------------------------------------------------------------------
export async function requestNativePermissions(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );
    await LocalNotifications.requestPermissions();
  } catch (e) {
    console.warn("[Native LN] permission request failed:", e);
  }
  // اهتزاز ترحيبي خفيف للتأكد أن الجسر يعمل
  try {
    const { Haptics } = await import("@capacitor/haptics");
    await Haptics.vibrate({ duration: 80 });
  } catch {
    /* تجاهل */
  }
}

function jsDayToCapacitorWeekday(jsDay: number): number {
  // JS: 0=الأحد ... 6=السبت | Capacitor: 1=الأحد ... 7=السبت
  return jsDay + 1;
}

export async function scheduleNativeAlarm(opts: {
  time: string; // "HH:MM"
  name: string;
  days: number[]; // 0=Sun..6=Sat
  lang: "ar" | "en";
}): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );

    // إلغاء أي جدولة سابقة أولاً
    await cancelNativeAlarm();

    const [hStr, mStr] = opts.time.split(":");
    const hour = Math.max(0, Math.min(23, parseInt(hStr || "5", 10)));
    const minute = Math.max(0, Math.min(59, parseInt(mStr || "0", 10)));
    const days =
      opts.days && opts.days.length > 0 ? opts.days : [0, 1, 2, 3, 4, 5, 6];

    const title =
      opts.lang === "ar"
        ? `🚨 استيقظ يا ${opts.name}!`
        : `🚨 Wake up ${opts.name}!`;
    const body =
      opts.lang === "ar"
        ? `حان وقت الفجر يا ${opts.name}! افتح التطبيق - لن يتوقف إلا بالتصوير! 🔒`
        : `Fajr time ${opts.name}! Open the app - only photo verification stops it! 🔒`;

    const notifications = days.map((d) => ({
      id: 1001 + d,
      title,
      body,
      schedule: {
        on: { hour, minute, weekday: jsDayToCapacitorWeekday(d) },
        repeats: true,
        allowWhileIdle: true,
      },
      smallIcon: "ic_launcher",
      largeIcon: "ic_launcher",
      ongoing: true, // لا يمكن سحبه وإغلاقه بسهولة
      autoCancel: false,
      extra: { type: "fajr-alarm", day: d },
    }));

    await LocalNotifications.schedule({ notifications } as never);
    console.log("🔔 [Native] alarm scheduled:", opts.time, days);
    return true;
  } catch (e) {
    console.warn("[Native] schedule alarm failed:", e);
    return false;
  }
}

/** إلغاء كل تنبيهات المنبه الأصلية */
export async function cancelNativeAlarm(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );
    try {
      const pending = await LocalNotifications.getPending();
      const list = (pending?.notifications || []) as Array<{ id: number }>;
      if (list.length > 0) {
        await LocalNotifications.cancel({
          notifications: list.map((n) => ({ id: n.id })),
        });
      }
    } catch {
      /* تجاهل */
    }
    // إزالة التنبيهات المعروضة حالياً إن أمكن
    try {
      const api = LocalNotifications as unknown as {
        removeAllDeliveredNotifications?: () => Promise<void>;
      };
      if (typeof api.removeAllDeliveredNotifications === "function") {
        await api.removeAllDeliveredNotifications();
      }
    } catch {
      /* تجاهل */
    }
  } catch {
    /* تجاهل */
  }
}

/** إشعار فوري أصلي (بديل Web Notification داخل الـ APK) */
export async function notifyNative(
  title: string,
  body: string
): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 9000 + Math.floor(Math.random() * 999),
          title,
          body,
          schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true },
          smallIcon: "ic_launcher",
          largeIcon: "ic_launcher",
          extra: { type: "instant" },
        },
      ],
    } as never);
    return true;
  } catch {
    return false;
  }
}

/** منع زر الرجوع من إغلاق التطبيق أثناء رنين المنبه */
export async function guardBackButtonWhileRinging(
  isRinging: () => boolean
): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  try {
    const { App } = await import("@capacitor/app");
    const listener = await App.addListener("backButton", ({ canGoBack }) => {
      if (isRinging()) {
        // المنبه يرن: تجاهل زر الرجوع تماماً - لن يهرب من الصلاة 😄
        console.log("🔒 Back blocked while ringing");
        return;
      }
      if (!canGoBack) {
        void App.exitApp();
      } else {
        window.history.back();
      }
    });
    return () => void listener.remove();
  } catch {
    return () => {};
  }
}

// ------------------------------------------------------------------
// معلومات وتحميل ملف APK الحقيقي
// ------------------------------------------------------------------
export interface ApkInfo {
  available: boolean;
  version: string;
  versionCode: number;
  fileName: string;
  sizeBytes: number;
  sizeLabel: string;
  updatedAt: string;
  url: string;
  releaseUrl: string;
  minAndroid: string;
  note?: string;
}

export const APK_RELEASE_URL =
  "https://github.com/y5747m-gif/moslm-we-bas-/releases/latest/download/hatsally.apk";

/** قراءة معلومات آخر نسخة APK مبنية */
export async function getApkInfo(): Promise<ApkInfo | null> {
  try {
    const res = await fetch("/downloads/apk-info.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as ApkInfo;
    return data;
  } catch {
    return null;
  }
}

/** تحميل ملف APK مع نسبة تقدم حقيقية */
export async function downloadApk(
  url: string,
  onProgress: (pct: number) => void
): Promise<Blob> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("download failed: HTTP " + res.status);
  const total = Number(res.headers.get("content-length") || 0);
  const reader = res.body?.getReader();
  if (!reader) {
    const blob = await res.blob();
    onProgress(100);
    return blob;
  }
  const chunks: BlobPart[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      if (total > 0) onProgress(Math.min(99, Math.round((loaded / total) * 100)));
    }
  }
  onProgress(100);
  return new Blob(chunks as BlobPart[], {
    type: "application/vnd.android.package-archive",
  });
}

/** بدء التنزيل الفعلي في المتصفح */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "hatsally.apk";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 5000);
}
