"use client";

/**
 * بطاقة منبه واحد في قائمة المنبهات ⏰
 * ----------------------------------------------------------------
 * الوقت بخط كبير كما في تطبيقات المنبهات الأصلية، مع مفتاح تفعيل،
 * ملخص التكرار ("كل يوم")، العدّاد الحي للرنين القادم، وأزرار
 * التجربة/التعديل/الحذف.
 */

import { Pencil, Play, Trash2, CalendarDays, Hourglass, BellRing } from "lucide-react";
import type { AlarmRecord } from "../../lib/alarms";
import { countdownText, dayWord, durationSummary, isDaily, repeatSummary } from "../../lib/alarms";
import type { Dict } from "../../lib/i18n";
import { haptic, type UiTokens } from "../../lib/ui";
import { Switch } from "./ui";

export default function AlarmCard({
  alarm,
  ui,
  rtl,
  language,
  t,
  now,
  nextRing,
  expired,
  onToggle,
  onEdit,
  onDelete,
  onTest,
}: {
  alarm: AlarmRecord;
  ui: UiTokens;
  rtl: boolean;
  language: "ar" | "en";
  t: Dict;
  now: Date;
  nextRing: Date | null;
  expired: boolean;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const on = alarm.enabled && !expired;
  const hhmm = alarm.time;
  const [hh, mm] = hhmm.split(":");
  const hour12 = language === "en" ? ((Number(hh) + 11) % 12) + 1 : Number(hh);
  const suffix =
    language === "en" ? (Number(hh) < 12 ? "AM" : "PM") : Number(hh) < 12 ? "ص" : "م";

  const iconBtn = `w-9 h-9 rounded-full border flex items-center justify-center transition active:scale-95`;

  return (
    <div
      className={`${ui.card} ${ui.shadow} border rounded-3xl overflow-hidden transition-all duration-300 ${
        on ? "" : "opacity-[0.62]"
      }`}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className={`text-[38px] leading-none font-black tracking-tight tabular-nums ${
                  on ? ui.text : ui.textSoft
                }`}
                dir="ltr"
              >
                {language === "en" ? hour12 : hh}
                <span className={on ? "text-emerald-400" : ""}>:</span>
                {mm}
              </span>
              <span className={`text-[12px] font-bold ${ui.textFaint}`}>{suffix}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {alarm.label ? (
                <span className={`text-[11.5px] font-bold px-2.5 py-1 rounded-full ${ui.accentSoft} ${ui.accentText} border max-w-[160px] truncate`}>
                  {alarm.label}
                </span>
              ) : null}
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                  isDaily(alarm) ? `${ui.accentSoft} ${ui.accentText}` : `${ui.cardSoft} ${ui.border} ${ui.textSoft}`
                }`}
              >
                <CalendarDays className="w-3 h-3" />
                {repeatSummary(alarm, t, language)}
              </span>
              {alarm.durationDays !== "forever" ? (
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${ui.cardSoft} ${ui.border} ${ui.textSoft} flex items-center gap-1`}>
                  <Hourglass className="w-3 h-3" />
                  {durationSummary(alarm, t)}
                </span>
              ) : null}
            </div>
          </div>
          <Switch checked={on} onChange={onToggle} ui={ui} rtl={rtl} />
        </div>

        {/* حالة الرنين القادم */}
        <div className={`mt-3 rounded-2xl border px-3 py-2 flex items-center gap-2 ${on ? ui.accentSoft : `${ui.cardSoft} ${ui.border}`}`}>
          <BellRing className={`w-3.5 h-3.5 shrink-0 ${on ? ui.accentText : ui.textFaint}`} />
          {expired ? (
            <p className={`text-[11px] font-bold text-amber-500`}>{t.expiredAlarm}</p>
          ) : on && nextRing ? (
            <p className={`text-[11px] font-bold ${ui.accentText} truncate`}>
              {t.ringsIn}{" "}
              <span className="font-mono tabular-nums">{countdownText(now, nextRing, language)}</span>
              <span className={ui.textFaint}> • </span>
              {dayWord(now, nextRing, t)}{" "}
              <span className="font-mono tabular-nums" dir="ltr">
                {String(nextRing.getHours()).padStart(2, "0")}:{String(nextRing.getMinutes()).padStart(2, "0")}
              </span>
            </p>
          ) : (
            <p className={`text-[11px] font-bold ${ui.textFaint}`}>{t.alarmOff}</p>
          )}
          <span className={`ms-auto text-[9.5px] font-black px-2 py-0.5 rounded-full ${on ? "bg-emerald-500 text-black" : `${ui.track} ${ui.textFaint}`}`}>
            {on ? t.alarmArmed : t.alarmOff}
          </span>
        </div>
      </div>

      {/* أزرار الإجراءات */}
      <div className={`flex items-center gap-2 px-4 py-2.5 border-t ${ui.border} ${ui.cardSoft}`}>
        <button
          onClick={() => {
            haptic(10);
            onTest();
          }}
          className={`${iconBtn} ${ui.cardSoft} ${ui.border} ${ui.textSoft}`}
          aria-label={t.testAlarm}
        >
          <Play className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            haptic(10);
            onEdit();
          }}
          className={`${iconBtn} ${ui.cardSoft} ${ui.border} ${ui.textSoft}`}
          aria-label={t.editWord}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            haptic(10);
            onDelete();
          }}
          className={`${iconBtn} bg-red-500/10 border-red-500/25 text-red-400`}
          aria-label={t.deleteWord}
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <p className={`ms-auto text-[10px] ${ui.textFaint} font-bold`}>{t.alarmWillRingDaily}</p>
      </div>
    </div>
  );
}
