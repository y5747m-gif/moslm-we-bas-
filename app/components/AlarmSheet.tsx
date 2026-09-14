"use client";

/**
 * لوح إضافة/تعديل منبه ⏰
 * ----------------------------------------------------------------
 * المستخدم يختار الوقت والاسم والتكرار والمدة، والافتراضي:
 * **يكرر كل يوم** في نفس الموعد - وهو المطلوب حتى لا يضبط المنبه مرة واحدة.
 */

import { useMemo, useState } from "react";
import { CalendarDays, Clock, Hourglass, Repeat, Tag, Trash2, Check } from "lucide-react";
import { EVERY_DAY, WEEKDAYS, WEEKEND, type AlarmDraft } from "../../lib/alarms";
import type { DurationDays } from "../../lib/schedule";
import type { Dict } from "../../lib/i18n";
import { haptic, type UiTokens } from "../../lib/ui";
import { Button, Chip, Sheet, Switch } from "./ui";

const PRESETS: Array<{ ar: string; en: string; time: string }> = [
  { ar: "قيام", en: "Qiyam", time: "03:00" },
  { ar: "الفجر", en: "Fajr", time: "04:40" },
  { ar: "الظهر", en: "Dhuhr", time: "12:15" },
  { ar: "العصر", en: "Asr", time: "15:40" },
  { ar: "المغرب", en: "Maghrib", time: "18:20" },
  { ar: "العشاء", en: "Isha", time: "19:45" },
];

const DAY_KEYS = [
  { id: 0, key: "sun" },
  { id: 1, key: "mon" },
  { id: 2, key: "tue" },
  { id: 3, key: "wed" },
  { id: 4, key: "thu" },
  { id: 5, key: "fri" },
  { id: 6, key: "sat" },
] as const;

export default function AlarmSheet({
  open,
  mode,
  initial,
  ui,
  rtl,
  language,
  t,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: AlarmDraft | null;
  ui: UiTokens;
  rtl: boolean;
  language: "ar" | "en";
  t: Dict;
  onClose: () => void;
  onSave: (draft: AlarmDraft) => void;
  onDelete?: () => void;
}) {
  // القيم الابتدائية تُحسب من المنبه المفتوح - اللوح يُركَّب من جديد عند كل فتح
  const srcDays = initial?.days && initial.days.length ? initial.days : [...EVERY_DAY];
  const srcDuration: DurationDays = initial?.durationDays ?? "forever";
  const srcCustom = srcDuration !== "forever" && ![7, 14, 30].includes(srcDuration as number);

  const [time, setTime] = useState(initial?.time || "05:00");
  const [label, setLabel] = useState(initial?.label || "");
  const [daily, setDaily] = useState(srcDays.length === 7);
  const [days, setDays] = useState<number[]>(srcDays);
  const [duration, setDuration] = useState<DurationDays>(srcDuration);
  const [customDays, setCustomDays] = useState(srcCustom ? (srcDuration as number) : 21);
  const [useCustom, setUseCustom] = useState(srcCustom);
  const [enabled, setEnabled] = useState(initial ? initial.enabled !== false : true);

  const effectiveDays = daily ? [...EVERY_DAY] : days;
  const effectiveDuration: DurationDays = useCustom
    ? Math.max(1, Math.min(3650, Number(customDays) || 1))
    : duration;

  const summary = useMemo(() => {
    const when = daily ? t.everyday : `${effectiveDays.length} ${effectiveDays.length === 1 ? t.daysLabel : t.daysLabelPlural}`;
    return language === "ar" ? `${when} • الساعة ${time}` : `${when} • at ${time}`;
  }, [daily, effectiveDays.length, time, t, language]);

  const canSave = effectiveDays.length > 0 && /^\d{2}:\d{2}$/.test(time);

  const toggleDay = (id: number) => {
    haptic(8);
    setDays((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].sort((a, b) => a - b)));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      ui={ui}
      rtl={rtl}
      title={mode === "create" ? t.addAlarm : t.editAlarm}
      subtitle={t.multiAlarmNote}
      footer={
        <div className="flex items-center gap-2">
          {mode === "edit" && onDelete ? (
            <button
              onClick={() => {
                haptic([15, 40, 15]);
                onDelete();
              }}
              className={`w-13 h-13 shrink-0 rounded-2xl border bg-red-500/10 border-red-500/25 text-red-400 flex items-center justify-center active:scale-95 transition`}
              aria-label={t.deleteWord}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          ) : null}
          <Button
            ui={ui}
            disabled={!canSave}
            onClick={() =>
              onSave({
                label: label.trim().slice(0, 40),
                time,
                days: effectiveDays,
                durationDays: effectiveDuration,
                startDate: null,
                enabled,
              })
            }
            className="flex-1 h-13"
          >
            <Check className="w-4 h-4" />
            {t.saveWord}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        {/* الوقت */}
        <div className={`${ui.cardSoft} border ${ui.border} rounded-3xl p-4`}>
          <p className={`text-[11px] font-bold ${ui.textFaint} flex items-center gap-1.5 mb-2`}>
            <Clock className="w-3.5 h-3.5" />
            {t.wakeTimeLabel}
          </p>
          <div className="flex items-center justify-center">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value || "05:00")}
              className={`w-full bg-transparent text-center text-[52px] leading-none font-black tabular-nums outline-none ${ui.text}`}
              style={{ colorScheme: ui.text.includes("white") ? "dark" : "light" }}
            />
          </div>
          <div className="flex gap-1.5 mt-3 overflow-x-auto app-scroll-thin pb-1">
            {PRESETS.map((p) => (
              <Chip
                key={p.time}
                ui={ui}
                active={time === p.time}
                onClick={() => {
                  setTime(p.time);
                  if (!label.trim()) setLabel(language === "ar" ? p.ar : p.en);
                }}
                className="shrink-0 h-9"
              >
                {language === "ar" ? p.ar : p.en} <span className="font-mono opacity-70" dir="ltr">{p.time}</span>
              </Chip>
            ))}
          </div>
        </div>

        {/* اسم المنبه */}
        <div className={`${ui.cardSoft} border ${ui.border} rounded-3xl p-4`}>
          <p className={`text-[11px] font-bold ${ui.textFaint} flex items-center gap-1.5 mb-2`}>
            <Tag className="w-3.5 h-3.5" />
            {t.alarmLabel}
          </p>
          <input
            type="text"
            value={label}
            maxLength={40}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t.alarmLabelPlaceholder}
            className={`w-full h-12 px-4 rounded-2xl border text-[14px] outline-none transition ${ui.input} ${ui.text}`}
          />
        </div>

        {/* التكرار كل يوم */}
        <div className={`${ui.cardSoft} border ${ui.border} rounded-3xl p-4`}>
          <div className="flex items-center gap-3">
            <span className={`w-10 h-10 rounded-2xl ${ui.accentSoft} border flex items-center justify-center shrink-0 ${ui.accentText}`}>
              <Repeat className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-[13.5px] font-black ${ui.text} flex items-center gap-2`}>
                {t.repeatDaily}
                {daily ? <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-emerald-500 text-black font-black">{t.dailyBadge}</span> : null}
              </p>
              <p className={`text-[11px] ${ui.textFaint} mt-0.5 leading-snug`}>{t.repeatDailyDesc}</p>
            </div>
            <Switch checked={daily} onChange={setDaily} ui={ui} rtl={rtl} />
          </div>

          {!daily ? (
            <div className="mt-4">
              <p className={`text-[11px] font-bold ${ui.textFaint} flex items-center gap-1.5 mb-2`}>
                <CalendarDays className="w-3.5 h-3.5" />
                {t.alarmDaysTitle}
              </p>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_KEYS.map((d) => {
                  const on = days.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggleDay(d.id)}
                      className={`h-12 rounded-2xl border text-[11px] font-black transition active:scale-95 ${
                        on ? ui.chipOn : ui.chip
                      }`}
                    >
                      {(t.daysShort as Record<string, string>)[d.key]}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1.5 mt-2">
                <Chip ui={ui} active={days.length === 7} onClick={() => setDays([...EVERY_DAY])} className="flex-1 h-9">
                  {t.everyday}
                </Chip>
                <Chip ui={ui} active={days.join() === WEEKDAYS.join()} onClick={() => setDays([...WEEKDAYS])} className="flex-1 h-9">
                  {t.weekdays}
                </Chip>
                <Chip ui={ui} active={days.join() === WEEKEND.join()} onClick={() => setDays([...WEEKEND])} className="flex-1 h-9">
                  {t.weekend}
                </Chip>
              </div>
            </div>
          ) : (
            <p className={`mt-3 text-[11px] font-bold ${ui.accentText} flex items-center gap-1.5`}>
              <Check className="w-3.5 h-3.5" />
              {t.alarmWillRingDaily}
            </p>
          )}
        </div>

        {/* مدة عمل المنبه */}
        <div className={`${ui.cardSoft} border ${ui.border} rounded-3xl p-4`}>
          <p className={`text-[11px] font-bold ${ui.textFaint} flex items-center gap-1.5 mb-2`}>
            <Hourglass className="w-3.5 h-3.5" />
            {t.durationTitle}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            <Chip ui={ui} active={!useCustom && duration === "forever"} onClick={() => { setUseCustom(false); setDuration("forever"); }}>
              {t.forever}
            </Chip>
            {[7, 14, 30].map((n) => (
              <Chip
                key={n}
                ui={ui}
                active={!useCustom && duration === n}
                onClick={() => {
                  setUseCustom(false);
                  setDuration(n);
                }}
              >
                {n} {t.daysLabelPlural}
              </Chip>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Chip ui={ui} active={useCustom} onClick={() => setUseCustom(true)}>
              {t.customDays}
            </Chip>
            {useCustom ? (
              <input
                type="number"
                min={1}
                max={3650}
                value={customDays}
                onChange={(e) => setCustomDays(Number(e.target.value))}
                className={`w-24 h-10 px-3 rounded-2xl border text-[13px] font-bold outline-none ${ui.input} ${ui.text}`}
              />
            ) : null}
            <span className={`text-[11px] ${ui.textFaint}`}>
              {t.alarmWillWorkFor} <b className={ui.text}>{effectiveDuration === "forever" ? t.forever : `${effectiveDuration}`}</b>{" "}
              {effectiveDuration === "forever" ? "" : Number(effectiveDuration) === 1 ? t.daysLabel : t.daysLabelPlural}
            </span>
          </div>
        </div>

        {/* التفعيل */}
        <div className={`${ui.cardSoft} border ${ui.border} rounded-3xl p-4 flex items-center gap-3`}>
          <div className="flex-1 min-w-0">
            <p className={`text-[13.5px] font-black ${ui.text}`}>{enabled ? t.alarmArmed : t.alarmOff}</p>
            <p className={`text-[11px] ${ui.textFaint} mt-0.5`}>{summary}</p>
          </div>
          <Switch checked={enabled} onChange={setEnabled} ui={ui} rtl={rtl} />
        </div>
      </div>
    </Sheet>
  );
}
