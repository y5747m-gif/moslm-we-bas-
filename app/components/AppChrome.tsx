"use client";

/**
 * هيكل التطبيق: الشريط العلوي + شريط التبويبات السفلي + زر الإضافة 📱
 * ----------------------------------------------------------------
 * هذا ما يعطي التطبيق هويته: تنقّل أصلي بتبويبات سفلية مثل تطبيقات
 * المنبهات على الهاتف، وليس تمرير صفحة ويب طويلة.
 */

import type { ReactNode } from "react";
import { Globe, Moon, Sun, Plus, WifiOff } from "lucide-react";
import { haptic, type UiTokens } from "../../lib/ui";

export type TabId = "alarms" | "verify" | "settings" | "about";

/* ───────────────────────── الشريط العلوي ───────────────────────── */
export function AppBar({
  appName,
  appSub,
  ui,
  rtl,
  language,
  onToggleLanguage,
  theme,
  onToggleTheme,
  installed,
  installedLabel,
  time,
}: {
  appName: string;
  appSub: string;
  ui: UiTokens;
  rtl: boolean;
  language: "ar" | "en";
  onToggleLanguage: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  installed: boolean;
  installedLabel: string;
  time: Date;
}) {
  return (
    <header className={`relative z-40 shrink-0 border-b ${ui.bar} backdrop-blur-xl`}>
      <div className="h-14 px-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-[0_6px_18px_rgba(16,185,129,0.35)] shrink-0">
          <span className="text-[17px] leading-none">🌙</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[14.5px] font-black leading-tight truncate ${ui.text}`}>{appName}</p>
          <p className={`text-[10px] ${ui.textFaint} leading-tight truncate`}>
            {appSub}
            {installed ? ` • ${installedLabel}` : ""}
          </p>
        </div>
        <span className={`hidden xs:block font-mono text-[12px] ${ui.textSoft} tabular-nums`}>
          {time.toLocaleTimeString(language === "ar" ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <button
          onClick={() => {
            haptic(8);
            onToggleLanguage();
          }}
          className={`w-9 h-9 rounded-full ${ui.cardSoft} border ${ui.border} flex items-center justify-center ${ui.textSoft} active:scale-95 transition`}
          aria-label="language"
        >
          {language === "ar" ? <Globe className="w-4 h-4" /> : <span className="text-[11px] font-black">ع</span>}
        </button>
        <button
          onClick={() => {
            haptic(8);
            onToggleTheme();
          }}
          className={`w-9 h-9 rounded-full ${ui.cardSoft} border ${ui.border} flex items-center justify-center ${ui.textSoft} active:scale-95 transition`}
          aria-label="theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}

/* ───────────────────────── شريط التبويبات السفلي ───────────────────────── */
export function TabBar({
  tabs,
  active,
  onChange,
  ui,
  rtl,
  badge,
}: {
  tabs: Array<{ id: TabId; label: string; icon: ReactNode }>;
  active: TabId;
  onChange: (id: TabId) => void;
  ui: UiTokens;
  rtl: boolean;
  badge?: Partial<Record<TabId, number>>;
}) {
  return (
    <nav className={`relative z-40 shrink-0 border-t ${ui.bar} backdrop-blur-xl`}>
      <div className="grid grid-cols-4 px-2 pt-1.5" dir={rtl ? "rtl" : "ltr"}>
        {tabs.map((tab) => {
          const on = tab.id === active;
          const count = badge?.[tab.id] || 0;
          return (
            <button
              key={tab.id}
              onClick={() => {
                haptic(on ? 4 : 12);
                if (!on) onChange(tab.id);
              }}
              className="relative h-14 flex flex-col items-center justify-center gap-1 rounded-2xl transition"
            >
              <span
                className={`absolute top-0 h-1 rounded-full transition-all duration-300 ${
                  on ? "w-8 bg-emerald-400" : "w-0 bg-transparent"
                }`}
              />
              <span className={`relative transition-transform ${on ? "scale-110 text-emerald-400" : ui.textFaint}`}>
                {tab.icon}
                {count > 0 ? (
                  <span className="absolute -top-1.5 -end-2 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-black text-[9px] font-black flex items-center justify-center">
                    {count}
                  </span>
                ) : null}
              </span>
              <span className={`text-[10px] font-bold transition ${on ? `${ui.text}` : ui.textFaint}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

/* ───────────────────────── زر الإضافة العائم ───────────────────────── */
export function Fab({ onClick, label, rtl }: { onClick: () => void; label: string; rtl: boolean }) {
  return (
    <button
      onClick={() => {
        haptic([12, 30, 12]);
        onClick();
      }}
      aria-label={label}
      className={`absolute bottom-5 ${rtl ? "left-5" : "right-5"} z-30 w-15 h-15 rounded-[22px] bg-gradient-to-br from-emerald-400 to-teal-600 text-black flex items-center justify-center shadow-[0_14px_35px_rgba(16,185,129,0.45)] active:scale-95 transition`}
    >
      <Plus className="w-7 h-7" strokeWidth={3} />
    </button>
  );
}

/* ───────────────────────── شريط حالة صغير (بدون إنترنت / مثبت) ───────────────────────── */
export function StatusStrip({
  ui,
  items,
}: {
  ui: UiTokens;
  items: Array<{ icon?: ReactNode; text: string; tone?: "ok" | "warn" | "muted" }>;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`flex items-center gap-2 px-4 py-2 border-b ${ui.border} ${ui.cardSoft} overflow-x-auto app-scroll-thin`}>
      {items.map((it, i) => (
        <span
          key={i}
          className={`shrink-0 flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-full border ${
            it.tone === "ok"
              ? `${ui.accentSoft} ${ui.accentText}`
              : it.tone === "warn"
                ? "bg-amber-500/12 border-amber-500/25 text-amber-500"
                : `${ui.cardSoft} ${ui.border} ${ui.textFaint}`
          }`}
        >
          {it.icon || <WifiOff className="w-3 h-3" />}
          {it.text}
        </span>
      ))}
    </div>
  );
}
