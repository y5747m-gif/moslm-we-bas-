"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Camera, AlarmClock, Battery, BellOff, Check, X, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import {
  PERMISSIONS,
  checkAllPermissions,
  requestPermission,
  type PermId,
  type PermStatus,
} from "../../lib/permissions";

const ICONS: Record<PermId, React.ReactNode> = {
  notifications: <Bell className="w-4 h-4" />,
  camera: <Camera className="w-4 h-4" />,
  exactAlarm: <AlarmClock className="w-4 h-4" />,
  battery: <Battery className="w-4 h-4" />,
  dnd: <BellOff className="w-4 h-4" />,
};

interface Props {
  t: Record<string, string>;
  dark: boolean;
  rtl: boolean;
  /** عدد الأذونات المعروضة (undefined = الكل) */
  compact?: boolean;
}

export default function PermissionsPanel({ t, dark, rtl, compact }: Props) {
  const [statuses, setStatuses] = useState<PermStatus[] | null>(null);
  const [busy, setBusy] = useState<PermId | null>(null);

  const refresh = useCallback(async () => {
    const all = await checkAllPermissions();
    setStatuses(all);
  }, []);

  useEffect(() => {
    void refresh();
    // إعادة الفحص عند العودة من شاشة إعدادات النظام
    const onVis = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [refresh]);

  const ask = async (id: PermId) => {
    setBusy(id);
    try {
      await requestPermission(id);
      // فحص فوري + فحص متأخر (لمن يعود من الإعدادات)
      await refresh();
      window.setTimeout(() => void refresh(), 2000);
    } finally {
      setBusy(null);
    }
  };

  const list = (statuses || PERMISSIONS.map((p) => ({ ...p, state: "unknown" as const }))).filter(
    (p) => !compact || p.critical
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          {t.permTitle || "Permissions"}
        </p>
        <button
          onClick={() => void refresh()}
          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${dark ? "bg-white/10 hover:bg-white/15" : "bg-zinc-200 hover:bg-zinc-300"} transition`}
        >
          <RefreshCw className="w-3 h-3" />
          {t.permRecheck || "Recheck"}
        </button>
      </div>

      {list.map((p) => {
        const st = p.state;
        const granted = st === "granted";
        const na = st === "na";
        return (
          <div
            key={p.id}
            className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${
              granted
                ? dark
                  ? "bg-emerald-500/10 border-emerald-500/25"
                  : "bg-emerald-50 border-emerald-200"
                : dark
                  ? "bg-white/5 border-white/10"
                  : "bg-zinc-100 border-zinc-200"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                granted ? "bg-emerald-500 text-black" : dark ? "bg-white/10 text-white/70" : "bg-zinc-200 text-zinc-600"
              }`}
            >
              {busy === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (ICONS[p.id] as React.ReactElement)}
            </div>
            <div className={`flex-1 min-w-0 ${rtl ? "text-right" : "text-left"}`}>
              <p className="text-[11px] font-bold flex items-center gap-1">
                {t["perm_" + p.id] || p.id}
                {p.critical && !granted && !na && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">
                    {t.permRequired || "Required"}
                  </span>
                )}
              </p>
              <p className={`text-[9px] leading-snug ${dark ? "text-white/50" : "text-zinc-500"}`}>
                {t["perm_" + p.id + "Desc"] || ""}
              </p>
            </div>
            {na ? (
              <span className={`text-[9px] font-bold ${dark ? "text-white/30" : "text-zinc-400"}`}>—</span>
            ) : granted ? (
              <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-black" />
              </span>
            ) : (
              <button
                onClick={() => void ask(p.id)}
                disabled={busy !== null}
                className="shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 transition disabled:opacity-50 flex items-center gap-1"
              >
                {st === "denied" ? <X className="w-3 h-3" /> : null}
                {st === "denied" ? t.permOpenSettings || "Settings" : t.permGrant || "Allow"}
              </button>
            )}
          </div>
        );
      })}
      <p className={`text-[9px] leading-relaxed ${dark ? "text-white/40" : "text-zinc-500"}`}>
        {t.permNote || ""}
      </p>
    </div>
  );
}
