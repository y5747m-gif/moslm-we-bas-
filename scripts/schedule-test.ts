/**
 * اختبار محرك الجدولة ⏱
 * تشغيل: npx tsx scripts/schedule-test.ts
 */
import { decideAlarm, computeNextRing, getTodayKey, type AlarmConfig } from "../lib/schedule";

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
const D = (s: string) => new Date(s); // ISO محلي
const key = (d: Date) => getTodayKey(d);
const base = (over: Partial<AlarmConfig>): AlarmConfig => ({
  time: "05:00",
  days: [0, 1, 2, 3, 4, 5, 6],
  startDate: null,
  durationDays: "forever",
  lastFiredKey: null,
  ...over,
});

// الجمعة 2026-09-11 (getDay=5)، السبت 12، الأحد 13
const FRI = 5, SAT = 6;

console.log("🧪 schedule tests:");

// 1. قبل الموعد اليوم → انتظار + القادم اليوم
{
  const now = D("2026-09-11T04:00:00");
  const r = decideAlarm(now, base({ days: [FRI] }));
  check("قبل الموعد = wait", r.action === "wait", r.action);
  check("القادم اليوم 05:00", r.nextRing?.getTime() === D("2026-09-11T05:00:00").getTime());
}
// 2. بعد الموعد بدقيقتين → رنين
{
  const r = decideAlarm(D("2026-09-11T05:02:00"), base({ days: [FRI] }));
  check("بعد الموعد بدقيقتين = ring", r.action === "ring", r.action);
}
// 3. حد المهلة (45 دقيقة) → رنين
{
  const r = decideAlarm(D("2026-09-11T05:45:00"), base({ days: [FRI] }));
  check("عند 45 دقيقة = ring", r.action === "ring", r.action);
}
// 4. بعد المهلة → فائت بصمت
{
  const r = decideAlarm(D("2026-09-11T05:46:00"), base({ days: [FRI] }));
  check("عند 46 دقيقة = missed", r.action === "missed", r.action);
}
// 5. فات اليوم → القادم الجمعة القادمة
{
  const r = decideAlarm(D("2026-09-11T06:00:00"), base({ days: [FRI] }));
  check("فات = missed", r.action === "missed", r.action);
  check("القادم الجمعة القادمة", r.nextRing?.getTime() === D("2026-09-18T05:00:00").getTime(), String(r.nextRing));
}
// 6. فلتر الأيام → السبت
{
  const r = decideAlarm(D("2026-09-11T06:00:00"), base({ days: [SAT] }));
  check("غير اليوم = wait", r.action === "wait", r.action);
  check("القادم السبت", r.nextRing?.getTime() === D("2026-09-12T05:00:00").getTime(), String(r.nextRing));
}
// 7. رنّ اليوم already → لا تكرار
{
  const now = D("2026-09-11T05:02:00");
  const r = decideAlarm(now, base({ days: [FRI], lastFiredKey: key(now) }));
  check("رنّ اليوم = wait", r.action === "wait", r.action);
}
// 8. مدة 7 أيام بدأت منذ 8 أيام → منتهي
{
  const r = decideAlarm(D("2026-09-11T04:00:00"), base({ startDate: "2026-09-03T05:00:00", durationDays: 7 }));
  check("بعد 8 أيام من مدة 7 = expired", r.action === "expired", r.action);
}
// 9. مدة يوم واحد بدأت أمس → منتهي
{
  const r = decideAlarm(D("2026-09-11T04:00:00"), base({ startDate: "2026-09-10T05:00:00", durationDays: 1 }));
  check("مدة يوم بدأت أمس = expired", r.action === "expired", r.action);
}
// 10. مدة يوم بدأت اليوم والموعد قادم → يعمل
{
  const r = decideAlarm(D("2026-09-11T04:00:00"), base({ startDate: "2026-09-11T04:30:00", durationDays: 1 }));
  check("مدة يوم اليوم = wait", r.action === "wait", r.action);
  check("القادم اليوم", r.nextRing?.getTime() === D("2026-09-11T05:00:00").getTime());
}
// 11. وقت غير صالح → inactive
{
  const r = decideAlarm(D("2026-09-11T04:00:00"), base({ time: "xx" }));
  check("وقت فاسد = inactive", r.action === "inactive", r.action);
}
// 12. بدون أيام → inactive
{
  const r = decideAlarm(D("2026-09-11T04:00:00"), base({ days: [] }));
  check("بدون أيام = inactive", r.action === "inactive", r.action);
}
// 13. منتصف الليل: 23:59 والموعد 00:05 → القادم الغد
{
  const n = computeNextRing(D("2026-09-11T23:59:00"), base({ time: "00:05" }));
  check("بعد منتصف الليل = الغد 00:05", n?.getTime() === D("2026-09-12T00:05:00").getTime(), String(n));
}
// 14. اليوم السادس من مدة 7 → ما زال يعمل
{
  const r = decideAlarm(D("2026-09-11T04:00:00"), base({ startDate: "2026-09-05T05:00:00", durationDays: 7 }));
  check("اليوم السادس من 7 = wait", r.action === "wait", r.action);
}
// 15. الثانية صفر ليست شرطاً: 05:00:37 → رنين (الخلل القديم كان يفوّته!)
{
  const r = decideAlarm(D("2026-09-11T05:00:37"), base({ days: [FRI] }));
  check("الثانية 37 = ring", r.action === "ring", r.action);
}

console.log(`\n📊 ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
