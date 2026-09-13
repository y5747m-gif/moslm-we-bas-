/**
 * الأذونات وفرض الاستيقاظ 🔐⏰
 * ----------------------------------------------------------------
 * المستخدم هو من يمنح الموافقات للبرنامج - كل إذن يُطلب بشرح واضح.
 * المنبه لا يُفعَّل إلا بعد منح الأذونات الحرجة:
 *  - الإشعارات + الكاميرا (ويب وتطبيق)
 *  - المنبه الدقيق + تجاهل تحسين البطارية (تطبيق APK فقط)
 *  - تجاوز عدم الإزعاج (مستحسن - تطبيق فقط)
 *
 * الفرض أثناء الرنين:
 *  - تطبيق: صوت أقصى + إيقاظ الشاشة فوق القفل + منع النوم
 *  - ويب: منع إطفاء الشاشة (Wake Lock) + ملء الشاشة إن أمكن
 */

import { registerPlugin } from "@capacitor/core";
import { isNativeApp } from "./native";

export type PermId = "notifications" | "exactAlarm" | "battery" | "dnd" | "camera";
export type PermState = "granted" | "denied" | "prompt" | "unknown" | "na";

export interface PermStatus {
  id: PermId;
  state: PermState;
  /** يعمل في التطبيق الأصلي فقط */
  nativeOnly: boolean;
  /** حرج: يمنع تفعيل المنبه بدونه */
  critical: boolean;
}

export const PERMISSIONS: Array<{ id: PermId; nativeOnly: boolean; critical: boolean }> = [
  { id: "notifications", nativeOnly: false, critical: true },
  { id: "camera", nativeOnly: false, critical: true },
  { id: "exactAlarm", nativeOnly: true, critical: true },
  { id: "battery", nativeOnly: true, critical: true },
  { id: "dnd", nativeOnly: true, critical: false },
];

// ------------------------------------------------------------------
// إضافة AlarmPower الأصلية (مسجلة في MainActivity)
// ------------------------------------------------------------------
interface AlarmPowerPlugin {
  canScheduleExactAlarms(): Promise<{ value: boolean }>;
  openExactAlarmSettings(): Promise<void>;
  isIgnoringBatteryOptimizations(): Promise<{ value: boolean }>;
  requestIgnoreBatteryOptimizations(): Promise<void>;
  hasDndAccess(): Promise<{ value: boolean }>;
  openDndSettings(): Promise<void>;
  setVolumeMax(): Promise<{ maxed: boolean }>;
  restoreVolume(): Promise<void>;
  acquireWakeLock(): Promise<void>;
  releaseWakeLock(): Promise<void>;
}

const AlarmPower = registerPlugin<AlarmPowerPlugin>("AlarmPower");

// ------------------------------------------------------------------
// فحص حالة إذن واحد
// ------------------------------------------------------------------
export async function checkPermission(id: PermId): Promise<PermState> {
  const native = isNativeApp();
  try {
    switch (id) {
      case "notifications": {
        if (native) {
          const { LocalNotifications } = await import("@capacitor/local-notifications");
          const r = await LocalNotifications.checkPermissions();
          return r.display === "granted" ? "granted" : r.display === "denied" ? "denied" : "prompt";
        }
        if (!("Notification" in window)) return "na";
        if (Notification.permission === "granted") return "granted";
        if (Notification.permission === "denied") return "denied";
        return "prompt";
      }
      case "exactAlarm": {
        if (!native) return "na";
        const r = await AlarmPower.canScheduleExactAlarms();
        return r.value ? "granted" : "prompt";
      }
      case "battery": {
        if (!native) return "na";
        const r = await AlarmPower.isIgnoringBatteryOptimizations();
        return r.value ? "granted" : "prompt";
      }
      case "dnd": {
        if (!native) return "na";
        const r = await AlarmPower.hasDndAccess();
        return r.value ? "granted" : "prompt";
      }
      case "camera": {
        // Permissions API للفحص بدون إزعاج المستخدم
        try {
          const pm = navigator.permissions;
          if (pm && typeof pm.query === "function") {
            const s = await pm.query({ name: "camera" as PermissionName });
            if (s.state === "granted") return "granted";
            if (s.state === "denied") return "denied";
            return "prompt";
          }
        } catch {
          /* غير مدعوم */
        }
        return "unknown";
      }
    }
  } catch {
    return "unknown";
  }
}

export async function checkAllPermissions(): Promise<PermStatus[]> {
  const out: PermStatus[] = [];
  for (const p of PERMISSIONS) {
    out.push({ ...p, state: await checkPermission(p.id) });
  }
  try {
    localStorage.setItem(
      "hatsally-perms",
      JSON.stringify({ at: Date.now(), states: out.map((o) => [o.id, o.state]) })
    );
  } catch {
    /* تجاهل */
  }
  return out;
}

/** هل كل الأذونات الحرجة ممنوحة؟ */
export async function checkCritical(): Promise<{ ok: boolean; missing: PermId[] }> {
  const all = await checkAllPermissions();
  const missing = all
    .filter((p) => p.critical && p.state !== "granted" && p.state !== "na")
    .map((p) => p.id);
  return { ok: missing.length === 0, missing };
}

// ------------------------------------------------------------------
// طلب إذن (يفتح حوار النظام أو شاشة الإعدادات)
// ------------------------------------------------------------------
export async function requestPermission(id: PermId): Promise<PermState> {
  const native = isNativeApp();
  try {
    switch (id) {
      case "notifications": {
        if (native) {
          const { LocalNotifications } = await import("@capacitor/local-notifications");
          const r = await LocalNotifications.requestPermissions();
          return r.display === "granted" ? "granted" : r.display === "denied" ? "denied" : "prompt";
        }
        if (!("Notification" in window)) return "na";
        return (await Notification.requestPermission()) as PermState;
      }
      case "exactAlarm": {
        if (!native) return "na";
        await AlarmPower.openExactAlarmSettings();
        return "unknown"; // يُعاد الفحص عند العودة من الإعدادات
      }
      case "battery": {
        if (!native) return "na";
        await AlarmPower.requestIgnoreBatteryOptimizations();
        return "unknown";
      }
      case "dnd": {
        if (!native) return "na";
        await AlarmPower.openDndSettings();
        return "unknown";
      }
      case "camera": {
        // طلب حقيقي ثم إغلاق فوري - الهدف نيل الموافقة فقط
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          stream.getTracks().forEach((tr) => tr.stop());
          return "granted";
        } catch (e: unknown) {
          const name = (e as { name?: string })?.name || "";
          if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
            return "denied";
          }
          return "unknown";
        }
      }
    }
  } catch {
    return "unknown";
  }
}

// ------------------------------------------------------------------
// فرض الاستيقاظ أثناء الرنين / التحرر بعده
// ------------------------------------------------------------------
let webWakeLock: { release: () => Promise<void> } | null = null;

async function acquireWebWakeLock(): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> };
    };
    if (nav.wakeLock && typeof nav.wakeLock.request === "function") {
      if (webWakeLock) {
        try {
          await webWakeLock.release();
        } catch {
          /* تجاهل */
        }
      }
      webWakeLock = await nav.wakeLock.request("screen");
      console.log("🔒 Web WakeLock acquired - screen stays on while ringing");
    }
  } catch (e) {
    console.log("[wake] web lock unavailable:", e);
  }
}

async function releaseWebWakeLock(): Promise<void> {
  if (webWakeLock) {
    try {
      await webWakeLock.release();
    } catch {
      /* تجاهل */
    }
    webWakeLock = null;
  }
}

/** تفعيل وضع الفرض: صوت أقصى + شاشة مستيقظة (يُستدعى عند بدء الرنين) */
export async function enforceRinging(): Promise<void> {
  if (isNativeApp()) {
    try {
      await Promise.all([AlarmPower.setVolumeMax(), AlarmPower.acquireWakeLock()]);
      console.log("🔊 Native enforce: volume MAX + wake lock + screen on");
    } catch (e) {
      console.warn("[enforce] native failed:", e);
    }
    return;
  }
  await acquireWebWakeLock();
  // محاولة ملء الشاشة (تنجح فقط بعد تفاعل المستخدم - الفشل صامت)
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  } catch {
    /* تجاهل */
  }
}

/** إنهاء وضع الفرض: إرجاع الصوت + تحرير القفل (عند اكتمال التحقق أو الإلغاء) */
export async function relaxAfterRinging(): Promise<void> {
  if (isNativeApp()) {
    try {
      await Promise.all([AlarmPower.restoreVolume(), AlarmPower.releaseWakeLock()]);
      console.log("🔉 Native relax: volume restored + wake lock released");
    } catch {
      /* تجاهل */
    }
    return;
  }
  await releaseWebWakeLock();
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen().catch(() => {});
    }
  } catch {
    /* تجاهل */
  }
}

// ------------------------------------------------------------------
// فتح التطبيق المثبت من الموقع (hatsally://) مع بديل للتحميل
// ------------------------------------------------------------------
export const NATIVE_SCHEME_URL = "hatsally://alarm";

/**
 * محاولة فتح التطبيق المثبت. إن فُتح التطبيق أُلغي البديل،
 * وإلا نُفّذ fallback (عادة: بدء تحميل APK).
 */
export function openNativeAppOr(fallback: () => void, timeoutMs = 2200): void {
  let done = false;
  const cancel = () => {
    done = true;
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onHide);
    window.removeEventListener("blur", onHide);
  };
  const onHide = () => {
    if (document.hidden) cancel();
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onHide);
  window.addEventListener("blur", onHide);
  // iframe مخفي: يفتح التطبيق دون صفحة خطأ إن لم يكن مثبتاً
  try {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = NATIVE_SCHEME_URL;
    document.body.appendChild(iframe);
    window.setTimeout(() => iframe.remove(), timeoutMs + 500);
  } catch {
    /* تجاهل */
  }
  window.setTimeout(() => {
    if (!done) {
      cancel();
      fallback();
    }
  }, timeoutMs);
}
