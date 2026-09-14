/**
 * اختبار محرك المنبهات المتعددة ⏰⏰
 * تشغيل: npm run test:alarms
 *
 * يتأكد من المطلوب:
 *  1) كل منبه يرن في نفس موعده **كل يوم** (تكرار يومي افتراضي)
 *  2) المستخدم يستطيع إضافة أكثر من منبه، وكل منبه مستقل
 *  3) الرنين يحدث لمنبه واحد (الأبكر) ولا يتكرر في اليوم نفسه
 */

// تخزين محلي وهمي حتى تعمل دوال الحفظ/الترحيل داخل Node
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

import {
  EVERY_DAY,
  autoExpire,
  countdownText,
  createAlarm,
  dayWord,
  defaultAlarm,
  dueAlarms,
  durationSummary,
  isDaily,
  loadAlarms,
  markFired,
  missedAlarms,
  nextRingAmong,
  nextRingOf,
  removeAlarm,
  repeatSummary,
  saveAlarms,
  sortAlarms,
  upsertAlarm,
  type AlarmRecord,
} from "../lib/alarms";
import { getTodayKey } from "../lib/schedule";
import { translations } from "../lib/i18n";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name} ${extra}`);
  }
}

const D = (s: string) => new Date(s);
const t = translations.ar;

function alarm(over: Partial<AlarmRecord> = {}): AlarmRecord {
  return {
    id: over.id || `a-${Math.random().toString(36).slice(2, 8)}`,
    nid: over.nid || 1001,
    label: over.label ?? "",
    time: over.time ?? "05:00",
    days: over.days ?? [...EVERY_DAY],
    durationDays: over.durationDays ?? "forever",
    startDate: over.startDate ?? null,
    enabled: over.enabled ?? true,
    lastFiredKey: over.lastFiredKey ?? null,
    createdAt: over.createdAt ?? Date.now(),
  };
}

console.log("🧪 multi-alarm tests:");

/* 1) التكرار اليومي الافتراضي */
{
  const a = alarm();
  check("الافتراضي كل يوم", isDaily(a) && a.days.length === 7);
  check("الافتراضي دائم", a.durationDays === "forever");
  const before = nextRingOf(D("2026-09-14T04:00:00"), a);
  check("الرنين اليوم 05:00", before?.getTime() === D("2026-09-14T05:00:00").getTime(), String(before));
  const after = nextRingOf(D("2026-09-14T06:00:00"), a);
  check("بعد الموعد: غداً نفس الوقت", after?.getTime() === D("2026-09-15T05:00:00").getTime(), String(after));
}

/* 2) منبه معطّل لا يرن ولا يُجدول */
{
  const a = alarm({ enabled: false });
  check("معطّل = لا رنين قادم", nextRingOf(D("2026-09-14T04:00:00"), a) === null);
  check("معطّل = ليس مستحقاً", dueAlarms(D("2026-09-14T05:01:00"), [a]).length === 0);
}

/* 3) الاستحقاق في نفس الموعد كل يوم */
{
  const a = alarm({ time: "05:00" });
  check("05:00:30 = مستحق", dueAlarms(D("2026-09-14T05:00:30"), [a]).length === 1);
  check("05:45 = مستحق (حد المهلة)", dueAlarms(D("2026-09-14T05:45:00"), [a]).length === 1);
  check("05:46 = فائت بصمت", missedAlarms(D("2026-09-14T05:46:00"), [a]).length === 1);
  check("04:59 = لم يحن", dueAlarms(D("2026-09-14T04:59:00"), [a]).length === 0);
}

/* 4) أكثر من منبه: الأبكر يرن أولاً والباقي يُعلَّم معه */
{
  const fajr = alarm({ id: "fajr", label: "الفجر", time: "04:40" });
  const qiyam = alarm({ id: "qiyam", label: "قيام", time: "03:00" });
  const dhuhr = alarm({ id: "dhuhr", label: "الظهر", time: "12:15" });
  const list = [fajr, qiyam, dhuhr];

  const due = dueAlarms(D("2026-09-14T04:41:00"), list);
  check("مستحق واحد عند 04:41", due.length === 1);
  check("الأبكر يرن (الفجر)", due[0]?.alarm.id === "fajr", due[0]?.alarm.id);

  const dueBoth = dueAlarms(D("2026-09-14T04:41:00"), [fajr, alarm({ id: "x", time: "04:30" })]);
  check("منبهان مستحقان معاً", dueBoth.length === 2);
  check("الترتيب الأبكر أولاً", dueBoth[0].alarm.time === "04:30");

  const next = nextRingAmong(D("2026-09-14T05:00:00"), list);
  check("القادم بين المنبهات = الظهر", next?.alarm.id === "dhuhr", next?.alarm.id);
  check("موعد القادم 12:15", next?.at.getTime() === D("2026-09-14T12:15:00").getTime());

  // تعليم المستحقة: لا رنين ثانياً في اليوم نفسه، ويعود غداً
  const marked = markFired(list, dueBoth.map((d) => d.alarm.id), getTodayKey(D("2026-09-14T04:41:00")));
  check("بعد التعليم لا استحقاق", dueAlarms(D("2026-09-14T04:42:00"), marked.filter((a) => a.time === "04:40" || a.time === "04:30")).length === 0);
  const tomorrow = nextRingOf(D("2026-09-14T05:00:00"), marked.find((a) => a.id === "fajr")!);
  check("الفجر يرن غداً نفس الموعد", tomorrow?.getTime() === D("2026-09-15T04:40:00").getTime(), String(tomorrow));
}

/* 5) انتهاء المدة يوقف المنبه تلقائياً */
{
  const week = alarm({ durationDays: 7, startDate: "2026-09-01T05:00:00" });
  const res = autoExpire([week], D("2026-09-14T04:00:00"));
  check("منتهٍ = يُوقف", res.changed && res.list[0].enabled === false);
  const fresh = alarm({ durationDays: 7, startDate: "2026-09-12T05:00:00" });
  const res2 = autoExpire([fresh], D("2026-09-14T04:00:00"));
  check("ضمن المدة = يبقى مفعّلاً", !res2.changed && res2.list[0].enabled === true);
}

/* 6) إضافة/تعديل/حذف/ترتيب */
{
  const a = createAlarm(defaultAlarm({ label: "الفجر", time: "04:40" }));
  const b = createAlarm(defaultAlarm({ label: "الظهر", time: "12:15" }));
  check("معرّفات فريدة", a.id !== b.id && a.nid !== b.nid);
  let list = upsertAlarm([], a);
  list = upsertAlarm(list, b);
  check("إضافة منبهين", list.length === 2);
  check("الترتيب حسب الوقت", list[0].time === "04:40" && list[1].time === "12:15");
  list = upsertAlarm(list, { ...b, time: "03:30" });
  check("التعديل لا يضاعف", list.length === 2);
  check("الترتيب بعد التعديل", list[0].time === "03:30");
  list = removeAlarm(list, a.id);
  check("الحذف", list.length === 1 && list[0].id === b.id);
  check("sortAlarms لا يعدّل الأصل", sortAlarms([b, a])[0].id === a.id);
}

/* 7) الملخصات والنصوص */
{
  check("ملخص كل يوم", repeatSummary(alarm(), t, "ar") === t.everyday);
  check("ملخص أيام عمل", repeatSummary(alarm({ days: [1, 2, 3, 4, 5] }), t, "ar") === t.weekdays);
  check("ملخص مدة دائمة", durationSummary(alarm(), t) === t.forever);
  check("ملخص مدة 7 أيام", durationSummary(alarm({ durationDays: 7 }), t).startsWith("7"));
  const nowD = D("2026-09-14T04:00:00");
  check("كلمة اليوم", dayWord(nowD, D("2026-09-14T05:00:00"), t) === t.ringsToday);
  check("كلمة غداً", dayWord(nowD, D("2026-09-15T05:00:00"), t) === t.ringsTomorrow);
  check("العدّاد", countdownText(nowD, D("2026-09-14T05:30:00"), "ar").includes("س"));
}

/* 8) الحفظ والترحيل من نسخة المنبه الواحد */
{
  store.clear();
  // لا بيانات: قائمة فارغة (التطبيق يبذر منبه الفجر الافتراضي)
  check("بداية نظيفة = لا منبهات", loadAlarms().length === 0);

  // بيانات قديمة (منبه واحد) → تُرحَّل إلى قائمة
  store.clear();
  store.set("hatsally-alarm-time", "04:35");
  store.set("hatsally-alarm-days", JSON.stringify([0, 1, 2, 3, 4, 5, 6]));
  store.set("hatsally-alarm-duration", "forever");
  store.set("hatsally-alarm-active", "true");
  store.set("hatsally-last-fired", "2026-09-13");
  const migrated = loadAlarms();
  check("ترحيل المنبه القديم", migrated.length === 1);
  check("الوقت محفوظ", migrated[0].time === "04:35");
  check("مفعّل", migrated[0].enabled === true);
  check("علامة آخر رنين محفوظة", migrated[0].lastFiredKey === "2026-09-13");

  // حفظ وقراءة قائمة متعددة
  const list = [
    alarm({ id: "one", time: "04:40", label: "الفجر" }),
    alarm({ id: "two", time: "12:15", label: "الظهر", days: [1, 2, 3, 4, 5] }),
  ];
  saveAlarms(list);
  const loaded = loadAlarms();
  check("حفظ/قراءة منبهين", loaded.length === 2);
  check("الأيام محفوظة", loaded.find((a) => a.id === "two")?.days.join() === "1,2,3,4,5");
  check("التوافق مع المفاتيح القديمة", store.get("hatsally-alarm-time") === "04:40");
}

console.log(`\n📊 ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
