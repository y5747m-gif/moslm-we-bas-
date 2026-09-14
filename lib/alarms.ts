/**
 * مخزن المنبهات المتعددة ⏰⏰⏰
 * ----------------------------------------------------------------
 * المستخدم يستطيع إضافة أي عدد من المنبهات، وكل منبه:
 *  - له وقته الخاص واسمه (فجر / ظهر / قيام / دراسة ...)
 *  - يكرر كل يوم افتراضياً (يرن في نفس الموعد المضبوط كل يوم)
 *  - له مدة عمل (دائم أو عدد أيام) وحالة تفعيل مستقلة
 *
 * التخزين في localStorage مع ترحيل تلقائي من نسخة المنبه الواحد القديمة،
 * والدوال هنا خالصة (pure) ما عدا دوال القراءة/الكتابة المصرَّح بها.
 */

import {
  RING_GRACE_MINUTES,
  computeNextRing,
  decideAlarm,
  getTodayKey,
  isExpired,
  type DurationDays,
} from "./schedule";
import type { Dict } from "./i18n";

export const EVERY_DAY: number[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS: number[] = [1, 2, 3, 4, 5];
export const WEEKEND: number[] = [0, 6];

/** أقصى عدد منبهات (حماية من العبث فقط - عملياً بلا حد) */
export const MAX_ALARMS = 100;

const STORE_KEY = "hatsally-alarms-v2";
const SEED_KEY = "hatsally-alarms-seed";

/** الأسماء القديمة (منبه واحد) - تُقرأ مرة واحدة للترحيل */
const LEGACY = {
  time: "hatsally-alarm-time",
  days: "hatsally-alarm-days",
  duration: "hatsally-alarm-duration",
  startDate: "hatsally-alarm-start-date",
  active: "hatsally-alarm-active",
  lastFired: "hatsally-last-fired",
  migrated: "hatsally-alarms-migrated-v2",
};

export interface AlarmRecord {
  /** معرّف نصي ثابت */
  id: string;
  /** معرّف رقمي لتنبيهات النظام الأصلية (Capacitor) */
  nid: number;
  /** اسم المنبه كما يكتبه المستخدم */
  label: string;
  /** "HH:MM" بصيغة 24 ساعة */
  time: string;
  /** أيام الأسبوع 0=الأحد ... 6=السبت (كل الأيام = يرن كل يوم) */
  days: number[];
  /** مدة العمل: "forever" أو عدد أيام */
  durationDays: DurationDays;
  /** تاريخ البدء ISO للمدد المحدودة */
  startDate: string | null;
  /** مفعّل أم متوقف */
  enabled: boolean;
  /** آخر يوم رنّ فيه "yyyy-mm-dd" حتى لا يرن مرتين في اليوم */
  lastFiredKey: string | null;
  createdAt: number;
}

export type AlarmDraft = Omit<AlarmRecord, "id" | "nid" | "createdAt" | "lastFiredKey">;

function sanitizeDays(days: unknown): number[] {
  if (!Array.isArray(days)) return [...EVERY_DAY];
  const out = days
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const unique = [...new Set(out)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : [...EVERY_DAY];
}

function sanitizeDuration(value: unknown): DurationDays {
  if (value === "forever") return "forever";
  const n = Number(value);
  if (Number.isInteger(n) && n > 0 && n <= 3650) return n;
  return "forever";
}

function sanitizeTime(value: unknown): string {
  const s = String(value || "");
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return "05:00";
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const min = Math.max(0, Math.min(59, Number(m[2])));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function normalize(raw: Partial<AlarmRecord> & { id?: string }, fallbackNid: number): AlarmRecord {
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `al-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nid: Number.isInteger(raw.nid) && (raw.nid as number) > 0 ? (raw.nid as number) : fallbackNid,
    label: typeof raw.label === "string" ? raw.label.slice(0, 40) : "",
    time: sanitizeTime(raw.time),
    days: sanitizeDays(raw.days),
    durationDays: sanitizeDuration(raw.durationDays),
    startDate: typeof raw.startDate === "string" && raw.startDate ? raw.startDate : null,
    enabled: raw.enabled !== false,
    lastFiredKey: typeof raw.lastFiredKey === "string" ? raw.lastFiredKey : null,
    createdAt: Number.isInteger(raw.createdAt) ? (raw.createdAt as number) : Date.now(),
  };
}

function nextSeed(): number {
  let seed = 1;
  try {
    const raw = localStorage.getItem(SEED_KEY);
    const n = Number(raw || "");
    if (Number.isInteger(n) && n > 0) seed = n;
    localStorage.setItem(SEED_KEY, String(seed + 1));
  } catch {
    /* وضع خاص/بدون تخزين: معرّف من الوقت */
    seed = Math.floor(Date.now() / 1000) % 100000;
  }
  return 1000 + seed;
}

/** ترحيل المنبه الواحد القديم إلى قائمة منبهات */
function migrateLegacy(): AlarmRecord[] {
  try {
    if (localStorage.getItem(LEGACY.migrated) === "true") return [];
    const time = localStorage.getItem(LEGACY.time);
    if (!time) return [];
    let days: number[] = [...EVERY_DAY];
    try {
      const parsed = JSON.parse(localStorage.getItem(LEGACY.days) || "");
      days = sanitizeDays(parsed);
    } catch {
      /* يبقى كل يوم */
    }
    const durationRaw = localStorage.getItem(LEGACY.duration);
    const alarm = normalize(
      {
        id: "legacy-main",
        nid: 1001,
        label: "",
        time,
        days,
        durationDays: durationRaw === "forever" || !durationRaw ? "forever" : sanitizeDuration(Number(durationRaw)),
        startDate: localStorage.getItem(LEGACY.startDate),
        enabled: localStorage.getItem(LEGACY.active) === "true",
        lastFiredKey: localStorage.getItem(LEGACY.lastFired),
        createdAt: Date.now(),
      },
      1001
    );
    return [alarm];
  } catch {
    return [];
  }
}

/** منبه افتراضي جاهز لأول تشغيل: الفجر 05:00 كل يوم */
export function defaultAlarm(over: Partial<AlarmDraft> = {}): AlarmDraft {
  return {
    label: "",
    time: "05:00",
    days: [...EVERY_DAY],
    durationDays: "forever",
    startDate: null,
    enabled: false,
    ...over,
  };
}

/** قراءة كل المنبهات (مع الترحيل من النسخة القديمة) */
export function loadAlarms(): AlarmRecord[] {
  let list: AlarmRecord[] = [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed
          .filter((x) => x && typeof x === "object")
          .map((x, i) => normalize(x as Partial<AlarmRecord>, 1000 + i + 1));
      }
    }
  } catch {
    list = [];
  }
  if (list.length === 0) {
    const migrated = migrateLegacy();
    if (migrated.length > 0) {
      list = migrated;
      saveAlarms(list);
    }
  }
  try {
    localStorage.setItem(LEGACY.migrated, "true");
  } catch {
    /* تجاهل */
  }
  return sortAlarms(list);
}

/** حفظ القائمة كاملة */
export function saveAlarms(list: AlarmRecord[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
    // إبقاء المفاتيح القديمة متوافقة مع أول منبه مفعّل (لأي كود/إضافة قديمة)
    const primary = list.find((a) => a.enabled) || list[0];
    if (primary) {
      localStorage.setItem(LEGACY.time, primary.time);
      localStorage.setItem(LEGACY.days, JSON.stringify(primary.days));
      localStorage.setItem(LEGACY.duration, primary.durationDays === "forever" ? "forever" : String(primary.durationDays));
      if (primary.startDate) localStorage.setItem(LEGACY.startDate, primary.startDate);
      localStorage.setItem(LEGACY.active, primary.enabled ? "true" : "false");
    }
  } catch {
    /* تجاهل */
  }
}

/** ترتيب حسب الوقت ثم تاريخ الإنشاء */
export function sortAlarms(list: AlarmRecord[]): AlarmRecord[] {
  return [...list].sort((a, b) => {
    if (a.time !== b.time) return a.time < b.time ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
}

/** إنشاء منبه جديد بمعرّف فريد */
export function createAlarm(draft: AlarmDraft): AlarmRecord {
  const nid = nextSeed();
  return normalize({ ...draft, nid, createdAt: Date.now(), lastFiredKey: null }, nid);
}

/** هل فات موعد هذا المنبه اليوم بأكثر من مهلة اللحاق؟ (إذاً يبدأ من الغد) */
export function passedTodayBeyondGrace(alarm: Pick<AlarmRecord, "time" | "days">, now: Date): boolean {
  const parts = alarm.time.split(":");
  const scheduled = new Date(now);
  scheduled.setHours(Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
  return (
    alarm.days.includes(now.getDay()) &&
    scheduled.getTime() <= now.getTime() &&
    (now.getTime() - scheduled.getTime()) / 60000 > RING_GRACE_MINUTES
  );
}

/**
 * تسليح منبه (تفعيله):
 * إن كان موعده اليوم قد فات بالفعل يبدأ من الغد - لا رنين مفاجئ لحظة التفعيل.
 */
export function armAlarm(alarm: Pick<AlarmRecord, "time" | "days">, now: Date): Partial<AlarmRecord> {
  return { enabled: true, lastFiredKey: passedTodayBeyondGrace(alarm, now) ? getTodayKey(now) : null };
}

export function upsertAlarm(list: AlarmRecord[], alarm: AlarmRecord): AlarmRecord[] {
  const idx = list.findIndex((a) => a.id === alarm.id);
  if (idx === -1) return sortAlarms([...list, alarm]);
  const next = [...list];
  next[idx] = alarm;
  return sortAlarms(next);
}

export function removeAlarm(list: AlarmRecord[], id: string): AlarmRecord[] {
  return list.filter((a) => a.id !== id);
}

export function patchAlarm(list: AlarmRecord[], id: string, patch: Partial<AlarmRecord>): AlarmRecord[] {
  return list.map((a) => (a.id === id ? { ...a, ...patch } : a));
}

/** هل هذا المنبه يكرر كل يوم؟ */
export function isDaily(a: Pick<AlarmRecord, "days">): boolean {
  return a.days.length === 7;
}

/** هل المنبه ما زال ضمن مدته؟ */
export function isAlarmExpired(now: Date, a: AlarmRecord): boolean {
  return isExpired(now, a.startDate, a.durationDays);
}

/** أقرب رنين لهذا المنبه */
export function nextRingOf(now: Date, a: AlarmRecord): Date | null {
  if (!a.enabled) return null;
  return computeNextRing(now, a);
}

export interface NextRingInfo {
  alarm: AlarmRecord;
  at: Date;
}

/** أقرب رنين بين كل المنبهات المفعّلة */
export function nextRingAmong(now: Date, list: AlarmRecord[]): NextRingInfo | null {
  let best: NextRingInfo | null = null;
  for (const a of list) {
    const at = nextRingOf(now, a);
    if (!at) continue;
    if (!best || at.getTime() < best.at.getTime()) best = { alarm: a, at };
  }
  return best;
}

/** المنبهات التي حان رنينها الآن (ضمن مهلة اللحاق) */
export function dueAlarms(now: Date, list: AlarmRecord[]): Array<{ alarm: AlarmRecord; scheduledFor: Date }> {
  const out: Array<{ alarm: AlarmRecord; scheduledFor: Date }> = [];
  for (const a of list) {
    if (!a.enabled) continue;
    const d = decideAlarm(now, a);
    if (d.action === "ring" && d.scheduledFor) out.push({ alarm: a, scheduledFor: d.scheduledFor });
  }
  // الأبكر أولاً
  return out.sort((x, y) => x.scheduledFor.getTime() - y.scheduledFor.getTime());
}

/** المنبهات التي فاتت مهلتها اليوم (تُعلَّم بصمت حتى لا ترن متأخرة) */
export function missedAlarms(now: Date, list: AlarmRecord[]): AlarmRecord[] {
  return list.filter((a) => a.enabled && decideAlarm(now, a).action === "missed");
}

/** تعليم منبهات بأنها رنّت اليوم (لمنع التكرار داخل اليوم نفسه) */
export function markFired(list: AlarmRecord[], ids: string[], dayKey: string): AlarmRecord[] {
  const set = new Set(ids);
  return list.map((a) => (set.has(a.id) ? { ...a, lastFiredKey: dayKey } : a));
}

/** إيقاف المنبهات التي انتهت مدتها تلقائياً */
export function autoExpire(list: AlarmRecord[], now: Date): { list: AlarmRecord[]; changed: boolean } {
  let changed = false;
  const next = list.map((a) => {
    if (a.enabled && isAlarmExpired(now, a)) {
      changed = true;
      return { ...a, enabled: false };
    }
    return a;
  });
  return { list: next, changed };
}

/** ملخص التكرار بلغة المستخدم: "كل يوم" / "أيام العمل" / قائمة الأيام */
export function repeatSummary(a: Pick<AlarmRecord, "days">, t: Dict, lang: "ar" | "en"): string {
  const days = a.days;
  if (days.length === 7) return t.everyday;
  if (days.length === 0) return t.selectDays;
  const same = (x: number[], y: number[]) => x.length === y.length && x.every((v, i) => v === y[i]);
  if (same(days, WEEKDAYS)) return t.weekdays;
  if (same(days, WEEKEND)) return t.weekend;
  const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const short = days.map((d) => (t.daysShort as Record<string, string>)[keys[d]] || "");
  if (lang === "ar") return short.join("، ");
  return short.join(" ");
}

/** ملخص المدة: "دائم" أو "12 يوم" */
export function durationSummary(a: Pick<AlarmRecord, "durationDays">, t: Dict): string {
  if (a.durationDays === "forever") return t.forever;
  const n = a.durationDays as number;
  return `${n} ${n === 1 ? t.daysLabel : t.daysLabelPlural}`;
}

/** نص "يرن بعد 3س 12د" للعدّاد الحي */
export function countdownText(now: Date, at: Date, lang: "ar" | "en"): string {
  const diff = Math.max(0, at.getTime() - now.getTime());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (lang === "ar") {
    if (h > 0) return `${h} س ${m} د`;
    if (m > 0) return `${m} د ${s} ث`;
    return `${s} ث`;
  }
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** "اليوم" / "غداً" / اسم اليوم */
export function dayWord(now: Date, at: Date, t: Dict): string {
  const todayKey = getTodayKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (getTodayKey(at) === todayKey) return t.ringsToday;
  if (getTodayKey(at) === getTodayKey(tomorrow)) return t.ringsTomorrow;
  return "";
}
