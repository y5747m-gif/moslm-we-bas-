/**
 * جسر محرك المنبه الأصلي ⏰🛡 (AlarmPower v2)
 * ------------------------------------------------------------------
 * هذا هو الخط المباشر إلى المحرك الأصلي داخل ملف الـ APK:
 *  - حفظ المنبه في إعدادات أندرويد الأصلية (لا في localStorage فقط)
 *  - جدولته عبر AlarmManager.setAlarmClock (الأدق في أندرويد، يوقظ من Doze)
 *  - تشغيل «الحارس»: خدمة أمامية تُبقي التطبيق حياً بعد إغلاقه وتعرض
 *    إشعاراً **مثبتاً** في شريط الإشعارات لا يستطيع المستخدم إزالته
 *  - الرنين الأصلي الكامل (صوت + اهتزاز + نداء بالاسم + شاشة فوق القفل)
 *    بدون أي اعتماد على الـ WebView
 *
 * على المتصفح العادي كل الدوال تفشل بأمان (reject) وتُعالَج في lib/native.ts.
 */

import { registerPlugin } from "@capacitor/core";

/** إصدار المحرك الأصلي الذي تتوقعه هذه الواجهة */
export const REQUIRED_ENGINE_VERSION = 2;

/** حالة المحرك الأصلي كما يُبلغ عنها الهاتف */
export interface NativeAlarmState {
  engineVersion: number;
  /** المنبه مسلح في النظام */
  armed: boolean;
  /** يرن الآن (صوت/اهتزاز/نداء) */
  ringing: boolean;
  ringStartedAt: number;
  /** "HH:MM" */
  time: string;
  /** أيام الأسبوع كنص "0,1,2,3,4,5,6" */
  days: string;
  name: string;
  lang: string;
  /** -1 = للأبد */
  durationDays: number;
  startMillis: number;
  /** آخر يوم رنّ فيه "yyyy-MM-dd" */
  lastFiredKey: string;
  graceMinutes: number;
  /** الموعد القادم (epoch millis) أو 0 */
  nextFireAt: number;
  nextFireIso: string;
  nextFireText: string;
  /** الموعد المسجل فعلاً في AlarmManager */
  scheduledAt: number;
  /** هل يحمل النظام موعداً في المستقبل؟ */
  alarmPendingInSystem: boolean;
  /** موعد منبه النظام التالي (للتأكد أن Android سجل منبهنا) */
  systemNextAlarmAt: number;
  /** خدمة الحارس (الإشعار المثبت) تعمل */
  serviceRunning: boolean;
  /** إذن المنبهات الدقيقة */
  exactAlarms: boolean;
  ignoringBattery: boolean;
  notificationsEnabled: boolean;
  fullScreenIntent: boolean;
  /** الموعد فات ضمن المهلة ولم نرنّ بعد (لحاق) */
  dueNow: boolean;
  expired: boolean;
}

export interface SetAlarmOptions {
  time: string;
  days: number[];
  name: string;
  lang: "ar" | "en";
  /** ISO أو epoch millis */
  startDate?: string | number | null;
  durationDays?: number | "forever";
  graceMinutes?: number;
  /** true = لا تمسح علامة «رنّ اليوم» (لإعادة المزامنة بدون رنين مزدوج) */
  keepLastFired?: boolean;
}

export interface AlarmPowerPlugin {
  // المحرك الأصلي الجديد
  engineVersion(): Promise<{ version: number }>;
  setAlarm(options: SetAlarmOptions): Promise<NativeAlarmState>;
  cancelAlarm(): Promise<NativeAlarmState>;
  syncNow(): Promise<NativeAlarmState>;
  getState(): Promise<NativeAlarmState>;
  startRinging(): Promise<NativeAlarmState>;
  stopRinging(): Promise<NativeAlarmState>;
  markFired(): Promise<NativeAlarmState>;
  testRing(options: { delaySeconds: number }): Promise<NativeAlarmState & { testAt: number; testWasArmed: boolean }>;
  hasFullScreenIntent(): Promise<{ value: boolean }>;
  openFullScreenIntentSettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  // فرض الاستيقاظ والأذونات
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

export const AlarmPower = registerPlugin<AlarmPowerPlugin>("AlarmPower");

/**
 * هل النسخة المثبتة من التطبيق تحمل المحرك الأصلي الجديد؟
 * (نسخة قديمة من الـ APK → false → نرجع لتنبيهات Capacitor المحلية)
 */
export async function hasNativeAlarmEngine(): Promise<boolean> {
  try {
    const r = await AlarmPower.engineVersion();
    return !!r && Number(r.version) >= REQUIRED_ENGINE_VERSION;
  } catch {
    return false;
  }
}
