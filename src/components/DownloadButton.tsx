"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, BellRing, ExternalLink } from "lucide-react";

type ApkInfo = {
  version: string;
  downloadUrl: string;
  releasesPage: string;
  sizeLabel: string | null;
  publishedAt: string | null;
  available: boolean;
};

export default function DownloadButton({ variant = "primary" }: { variant?: "primary" | "large" }) {
  const [info, setInfo] = useState<ApkInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/apk-info")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const href = info?.downloadUrl ?? "#";
  const big = variant === "large";

  return (
    <div className="flex flex-col items-center gap-3">
      <a
        href={href}
        className={[
          "group inline-flex items-center gap-3 rounded-2xl font-bold transition-all",
          "bg-gradient-to-l from-amber-400 to-yellow-500 text-slate-950",
          "hover:from-amber-300 hover:to-yellow-400 hover:scale-[1.02] active:scale-[0.99]",
          "animate-pulse-ring",
          big ? "px-10 py-5 text-2xl" : "px-8 py-4 text-xl",
        ].join(" ")}
      >
        {loading ? (
          <Loader2 className={big ? "h-7 w-7 animate-spin" : "h-6 w-6 animate-spin"} />
        ) : (
          <Download className={big ? "h-7 w-7 transition-transform group-hover:translate-y-0.5" : "h-6 w-6 transition-transform group-hover:translate-y-0.5"} />
        )}
        تحميل التطبيق (APK)
      </a>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-slate-300">
        {info ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <BellRing className="h-4 w-4 text-amber-400" />
              الإصدار {info.version}
            </span>
            {info.sizeLabel && <span>الحجم: {info.sizeLabel}</span>}
            <span>أندرويد 8.0 فأحدث</span>
          </>
        ) : (
          <span>{loading ? "جارٍ تجهيز رابط التحميل…" : "الإصدار 1.0.0 • أندرويد 8.0 فأحدث"}</span>
        )}
      </div>

      {info && !info.available && !loading && (
        <p className="max-w-md text-center text-xs leading-6 text-slate-400">
          أول نسخة من التطبيق تُبنى الآن تلقائياً. إذا لم يبدأ التحميل، تفقّد{" "}
          <a href={info.releasesPage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-amber-300 underline underline-offset-4">
            صفحة الإصدارات <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      )}
    </div>
  );
}
