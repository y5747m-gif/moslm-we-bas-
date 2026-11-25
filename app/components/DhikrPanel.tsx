"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X, Sparkles, RotateCcw, CheckCircle2 } from "lucide-react";
import { DHIKR_LIST, DHIKR_TARGET, MOTIVATION_AR, MOTIVATION_EN, type Dhikr } from "../../lib/dhikr";

interface DhikrPanelProps {
  open: boolean;
  onClose: () => void;
  language: "ar" | "en";
}

const STORAGE_KEY = "hatsally-dhikr-counts-v1";

function loadCounts(): Record<number, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<number, number>;
  } catch {
    /* ignore */
  }
  return {};
}

export default function DhikrPanel({ open, onClose, language }: DhikrPanelProps) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);
  const [pulseId, setPulseId] = useState<number | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgIdx = useRef(0);

  useEffect(() => {
    if (open) {
      setCounts(loadCounts());
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const totalDone = useMemo(
    () => Object.values(counts).reduce((a, b) => a + Math.min(b, DHIKR_TARGET), 0),
    [counts]
  );
  const totalTarget = DHIKR_LIST.length * DHIKR_TARGET;
  const overallPct = Math.round((totalDone / totalTarget) * 100);

  const pickMessage = useCallback(() => {
    const list = language === "ar" ? MOTIVATION_AR : MOTIVATION_EN;
    const text = list[msgIdx.current % list.length];
    msgIdx.current += 1;
    setMessage({ text, id: Date.now() });
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMessage(null), 2200);
  }, [language]);

  const increment = useCallback(
    (id: number) => {
      setCounts((prev) => {
        const cur = prev[id] ?? 0;
        if (cur >= DHIKR_TARGET) return prev;
        const next = cur + 1;
        const updated = { ...prev, [id]: next };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          /* ignore */
        }
        return updated;
      });
      setPulseId(id);
      setTimeout(() => setPulseId((p) => (p === id ? null : p)), 350);
      pickMessage();
    },
    [pickMessage]
  );

  const resetOne = useCallback((id: number) => {
    setCounts((prev) => {
      const updated = { ...prev, [id]: 0 };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  }, []);

  if (!open) return null;

  const t = language === "ar" ? DICT.ar : DICT.en;

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-[#04100e]/97 backdrop-blur-xl animate-dhikr-in"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="shrink-0 px-4 pt-5 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black shadow-lg shadow-emerald-500/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-extrabold text-lg text-white leading-tight">{t.title}</h2>
            <p className="text-[11px] text-emerald-300/90 truncate">{t.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.close}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overall progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-white/70 mb-1">
            <span>{t.overall}</span>
            <span className="font-bold text-emerald-300">{overallPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Motivational toast */}
      {message && (
        <div
          key={message.id}
          className="pointer-events-none fixed left-1/2 top-20 -translate-x-1/2 z-[130] px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-[13px] font-bold shadow-xl shadow-emerald-500/30 animate-motivation"
        >
          {message.text}
        </div>
      )}

      {/* Cards grid */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
          {DHIKR_LIST.map((d) => (
            <DhikrCard
              key={d.id}
              dhikr={d}
              count={counts[d.id] ?? 0}
              language={language}
              pulse={pulseId === d.id}
              onTap={() => increment(d.id)}
              onReset={() => resetOne(d.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  dhikr: Dhikr;
  count: number;
  language: "ar" | "en";
  pulse: boolean;
  onTap: () => void;
  onReset: () => void;
}

function DhikrCard({ dhikr, count, language, pulse, onTap, onReset }: CardProps) {
  const pct = Math.min(count / DHIKR_TARGET, 1);
  const R = 34;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - pct);
  const done = count >= DHIKR_TARGET;
  const ar = language === "ar";

  return (
    <div
      className={`relative flex flex-col rounded-2xl p-3 border bg-white/[0.04] backdrop-blur transition-all duration-300 hover:border-emerald-400/40 ${
        done ? "border-emerald-400/60 shadow-lg shadow-emerald-500/20" : "border-white/10"
      } ${pulse ? "animate-card-pop scale-[1.02]" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Circular counter */}
        <button
          onClick={onTap}
          aria-label={ar ? "سبّح" : "Tasbih"}
          className="relative shrink-0 w-[84px] h-[84px] rounded-full grid place-items-center focus:outline-none group"
          style={{ touchAction: "manipulation" }}
        >
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 84 84">
            <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
            <circle
              cx="42"
              cy="42"
              r={R}
              fill="none"
              stroke="url(#grad)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#2dd4bf" />
              </linearGradient>
            </defs>
          </svg>
          <span
            className={`relative z-10 text-lg font-extrabold tabular-nums ${
              done ? "text-emerald-300" : "text-white"
            }`}
          >
            {count}
          </span>
          {/* rotating shimmer when pulsing */}
          {pulse && (
            <span className="absolute inset-0 rounded-full border-2 border-emerald-300/70 animate-ring-spin" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold">
              #{dhikr.id}
            </span>
            {done ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <button
                onClick={onReset}
                aria-label={ar ? "إعادة" : "Reset"}
                className="text-white/30 hover:text-white/70 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p
            className={`text-[12px] leading-snug font-semibold ${
              ar ? "text-right" : "text-left"
            } text-emerald-50/95`}
            dir="rtl"
          >
            {dhikr.ar}
          </p>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/5">
        <p className="text-[10px] text-amber-200/80 leading-snug">{dhikr.virtue}</p>
        <p className="text-[9px] text-white/40 mt-0.5">
          {ar ? "السنة: " : "Sunnah: "}
          {dhikr.sunnah} · {dhikr.source}
        </p>
      </div>

      {done && (
        <div className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-emerald-500 text-black text-[9px] font-bold animate-bounce-once">
          {ar ? "أُتمِم ✓" : "Done ✓"}
        </div>
      )}
    </div>
  );
}

const DICT = {
  ar: {
    title: "أذكار الصباح والمساء",
    subtitle: "٤٠ ذكراً من إسلام ويب · اضغط الدائرة لتسبّح حتى ١٠٠",
    overall: "إجمالي التسبيح",
    close: "إغلاق",
  },
  en: {
    title: "Morning & Evening Adhkar",
    subtitle: "40 adhkar from IslamWeb · tap the circle to count up to 100",
    overall: "Total tasbih",
    close: "Close",
  },
};
