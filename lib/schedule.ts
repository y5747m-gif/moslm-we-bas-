/**
 * محرك جدولة المنبه ⏱
 * ----------------------------------------------------------------
 * دوال خالصة (Pure) بدون اعتماد على المتصفح - قابلة للاختبار.
 * القاعدة الذهبية: الرنين يحدث عندما يحين الوقت أو بعده بمهلة،
 * مرة واحدة فقط في اليوم (lastFired)، وليس عند الثانية صفر!
 */

export type DurationDays = "forever" | number;

export interface AlarmConfig {
  /** "HH:MM" بصيغة 24 ساعة */
  time: string;
  /** أيام الأسبوع 0=الأحد ... 6=السبت */
  days: number[];
  /** تاريخ بدء المنبه ISO (للمدد المحدودة) */
  startDate: string | null;
  durationDays: DurationDays;
  /** مفتاح آخر يوم رنّ فيه "yyyy-mm-dd" */
  lastFiredKey: string | null;
}

/** مهلة اللحاق بالرنين بالدقائق (لو فُتح التطبيق متأخراً) */
export const RING_GRACE_MINUTES = 45;

export type RingAction = "ring" | "wait" | "missed" | "expired" | "inactive";

export interface RingDecision {
  action: RingAction;
  /** موعد رنين اليوم المجدول (إن وجد) */
  scheduledFor: Date | null;
  /** أقرب رنين قادم (للعرض) */
  nextRing: Date | null;
}

export function getTodayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseTime(time: string): { h: number; m: number } | null {
  const parts = (time || "").split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function atTime(base: Date, h: number, m: number): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** هل انتهت مدة المنبه؟ */
export function isExpired(now: Date, startDate: string | null, durationDays: DurationDays): boolean {
  if (durationDays === "forever") return false;
  if (!startDate) return false;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return false;
  const diffDays = Math.floor((startOfDay(now).getTime() - startOfDay(start).getTime()) / 86400000);
  const limit = typeof durationDays === "number" ? durationDays : 30;
  return diffDays >= limit;
}

/** أقرب رنين قادم بعد now (بحث 8 أيام للأمام) */
export function computeNextRing(now: Date, cfg: Pick<AlarmConfig, "time" | "days" | "startDate" | "durationDays">): Date | null {
  if (!cfg.days || cfg.days.length === 0) return null;
  if (isExpired(now, cfg.startDate, cfg.durationDays)) return null;
  const t = parseTime(cfg.time);
  if (!t) return null;
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    if (!cfg.days.includes(day.getDay())) continue;
    const candidate = atTime(day, t.h, t.m);
    if (candidate.getTime() <= now.getTime()) continue;
    // احترام نهاية المدة المحدودة
    if (cfg.durationDays !== "forever" && cfg.startDate) {
      const start = new Date(cfg.startDate);
      if (!Number.isNaN(start.getTime())) {
        const limit = typeof cfg.durationDays === "number" ? cfg.durationDays : 30;
        const end = startOfDay(start);
        end.setDate(end.getDate() + limit);
        if (startOfDay(candidate).getTime() >= end.getTime()) continue;
      }
    }
    return candidate;
  }
  return null;
}

/**
 * القرار في هذه اللحظة:
 * - ring: حان الوقت (أو فات ضمن المهلة) ولم نرنّ اليوم بعد
 * - missed: فات الوقت أكثر من المهلة ولم نرنّ (يُعلَّم اليوم كمنتهٍ بصمت)
 * - wait: لم يحن الوقت بعد (أو رنّ اليوم already)
 * - expired: انتهت المدة
 * - inactive: لا أيام مختارة أو وقت غير صالح
 */
export function decideAlarm(now: Date, cfg: AlarmConfig): RingDecision {
  const nextRing = computeNextRing(now, cfg);
  if (!cfg.days || cfg.days.length === 0) return { action: "inactive", scheduledFor: null, nextRing };
  const t = parseTime(cfg.time);
  if (!t) return { action: "inactive", scheduledFor: null, nextRing };
  if (isExpired(now, cfg.startDate, cfg.durationDays)) {
    return { action: "expired", scheduledFor: null, nextRing: null };
  }
  const todayKey = getTodayKey(now);
  if (cfg.lastFiredKey === todayKey) {
    return { action: "wait", scheduledFor: null, nextRing };
  }
  if (!cfg.days.includes(now.getDay())) {
    return { action: "wait", scheduledFor: null, nextRing };
  }
  const scheduled = atTime(now, t.h, t.m);
  if (now.getTime() < scheduled.getTime()) {
    return { action: "wait", scheduledFor: scheduled, nextRing };
  }
  const lateMin = (now.getTime() - scheduled.getTime()) / 60000;
  if (lateMin <= RING_GRACE_MINUTES) {
    return { action: "ring", scheduledFor: scheduled, nextRing };
  }
  return { action: "missed", scheduledFor: scheduled, nextRing };
}
