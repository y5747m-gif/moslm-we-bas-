"use client";

/**
 * عناصر الواجهة الأساسية للتطبيق 🧩
 * ----------------------------------------------------------------
 * مفاتيح/بطاقات/ألواح سفلية بنمط واحد، تُستخدم في كل الشاشات حتى
 * تبقى هوية التطبيق واحدة (تشبه تطبيقات الهاتف الأصلية).
 */

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { haptic, type UiTokens } from "../../lib/ui";

/* ───────────────────────── مفتاح التبديل ───────────────────────── */
export function Switch({
  checked,
  onChange,
  ui,
  rtl,
  disabled,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ui: UiTokens;
  rtl: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const w = size === "sm" ? "w-11 h-6" : "w-13 h-7";
  const knob = size === "sm" ? "w-5 h-5" : "w-6 h-6";
  const shift = size === "sm" ? "translate-x-5" : "translate-x-6";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        haptic(10);
        onChange(!checked);
      }}
      className={`relative shrink-0 ${w} rounded-full border transition-colors duration-200 ${
        checked ? "bg-emerald-500 border-emerald-400" : `${ui.track} ${ui.border}`
      } ${disabled ? "opacity-40" : ""}`}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 ${knob} rounded-full bg-white shadow transition-all duration-200 ${
          rtl ? "right-0.5" : "left-0.5"
        } ${checked ? (rtl ? `-${shift}` : shift) : ""}`}
      />
    </button>
  );
}

/* ───────────────────────── بطاقة ───────────────────────── */
export function Card({
  children,
  ui,
  className = "",
  soft,
  onClick,
}: {
  children: ReactNode;
  ui: UiTokens;
  className?: string;
  soft?: boolean;
  onClick?: () => void;
}) {
  const base = soft ? ui.cardSoft : `${ui.card} ${ui.shadow}`;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`${base} border rounded-3xl ${onClick ? "w-full text-start active:scale-[0.99] transition" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

/* ───────────────────────── عنوان قسم ───────────────────────── */
export function SectionTitle({
  children,
  ui,
  hint,
}: {
  children: ReactNode;
  ui: UiTokens;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-2 px-1 pt-4 pb-2">
      <h2 className={`text-[13px] font-extrabold tracking-wide ${ui.textSoft}`}>{children}</h2>
      {hint ? <span className={`text-[11px] ${ui.textFaint}`}>{hint}</span> : null}
    </div>
  );
}

/* ───────────────────────── صف إعدادات ───────────────────────── */
export function Row({
  icon,
  title,
  subtitle,
  right,
  ui,
  onClick,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  ui: UiTokens;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 ${onClick ? "cursor-pointer active:bg-white/5" : ""}`}
    >
      {icon ? (
        <span className={`w-9 h-9 rounded-2xl ${ui.cardSoft} border ${ui.border} flex items-center justify-center shrink-0 ${ui.accentText}`}>
          {icon}
        </span>
      ) : null}
      <span className="flex-1 min-w-0">
        <span className={`block text-[13.5px] font-bold ${ui.text} truncate`}>{title}</span>
        {subtitle ? <span className={`block text-[11px] ${ui.textFaint} mt-0.5 leading-snug`}>{subtitle}</span> : null}
      </span>
      {right ? <span className="shrink-0 flex items-center gap-2">{right}</span> : null}
    </div>
  );
}

/* ───────────────────────── زر رئيسي ───────────────────────── */
export function Button({
  children,
  onClick,
  ui,
  variant = "primary",
  className = "",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  ui: UiTokens;
  variant?: "primary" | "soft" | "danger" | "ghost";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles =
    variant === "primary"
      ? "bg-emerald-500 text-black font-extrabold hover:bg-emerald-400"
      : variant === "danger"
        ? "bg-red-500 text-white font-extrabold hover:bg-red-400"
        : variant === "ghost"
          ? `${ui.cardSoft} border ${ui.border} ${ui.text} font-bold`
          : `${ui.track} ${ui.text} font-bold`;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        haptic(12);
        onClick?.();
      }}
      className={`h-13 px-5 rounded-2xl text-[14px] flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-45 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

/* ───────────────────────── خيار (chip) ───────────────────────── */
export function Chip({
  children,
  active,
  onClick,
  ui,
  className = "",
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
  ui: UiTokens;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic(8);
        onClick();
      }}
      className={`h-10 px-3.5 rounded-2xl text-[12px] font-bold border transition active:scale-[0.97] ${
        active ? ui.chipOn : ui.chip
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ───────────────────────── لوح سفلي (Sheet) ───────────────────────── */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  ui,
  rtl,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  ui: UiTokens;
  rtl: boolean;
  dismissible?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissible]);

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[90] flex items-end" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[3px] animate-fade-in"
        onClick={() => dismissible && onClose()}
      />
      <div
        className={`relative w-full max-h-[92%] flex flex-col rounded-t-[2rem] border-t ${ui.border} ${
          ui.card
        } shadow-[0_-20px_60px_rgba(0,0,0,0.55)] animate-sheet-up`}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className={`w-10 h-1.5 rounded-full ${ui.track}`} />
        </div>
        {(title || dismissible) && (
          <div className={`flex items-center gap-3 px-5 pb-3 ${rtl ? "" : ""}`}>
            <div className="flex-1 min-w-0">
              {title ? <h3 className={`text-[16px] font-black ${ui.text} truncate`}>{title}</h3> : null}
              {subtitle ? <p className={`text-[11.5px] ${ui.textFaint} mt-0.5 leading-snug`}>{subtitle}</p> : null}
            </div>
            {dismissible ? (
              <button
                onClick={() => {
                  haptic(8);
                  onClose();
                }}
                className={`w-9 h-9 rounded-full ${ui.cardSoft} border ${ui.border} flex items-center justify-center ${ui.textSoft}`}
                aria-label="close"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        )}
        <div className="flex-1 overflow-y-auto app-scroll px-5 pb-3">{children}</div>
        {footer ? <div className={`px-5 pt-2 pb-5 border-t ${ui.border}`}>{footer}</div> : <div className="h-4" />}
      </div>
    </div>
  );
}

/* ───────────────────────── شريط تقدم رفيع ───────────────────────── */
export function Progress({ value, ui, tone = "accent" }: { value: number; ui: UiTokens; tone?: "accent" | "danger" | "warn" }) {
  const color = tone === "danger" ? "bg-red-500" : tone === "warn" ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className={`w-full h-1.5 rounded-full overflow-hidden ${ui.track}`}>
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
