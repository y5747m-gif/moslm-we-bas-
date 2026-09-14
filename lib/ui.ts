/**
 * هوية التطبيق البصرية 🎨
 * ----------------------------------------------------------------
 * مجموعة ألوان/كلاسات واحدة تُمرَّر لكل الشاشات، حتى يبدو التطبيق
 * تطبيقاً واحداً متماسكاً (وليس صفحة ويب) في الوضعين الداكن والفاتح.
 */

export interface UiTokens {
  /** خلفية الشاشة */
  screen: string;
  /** شريط التطبيق العلوي */
  bar: string;
  /** بطاقة أساسية */
  card: string;
  /** بطاقة ثانوية/غائرة */
  cardSoft: string;
  /** حدود */
  border: string;
  /** فواصل بين الصفوف */
  divide: string;
  /** نص أساسي/ثانوي/باهت */
  text: string;
  textSoft: string;
  textFaint: string;
  /** حقل إدخال */
  input: string;
  /** زر خيار (غير مختار / مختار) */
  chip: string;
  chipOn: string;
  /** شريط تقدم/مؤشر */
  track: string;
  /** لمسة اللون الأخضر */
  accent: string;
  accentSoft: string;
  accentText: string;
  /** تنبيه/خطر */
  danger: string;
  dangerSoft: string;
  /** ظل ناعم */
  shadow: string;
}

export function tokens(isDark: boolean): UiTokens {
  return isDark
    ? {
        screen: "bg-[#04100e] text-white",
        bar: "bg-[#061714]/95 border-white/[0.06]",
        card: "bg-[#0a1c19] border-white/[0.07]",
        cardSoft: "bg-white/[0.03] border-white/[0.06]",
        border: "border-white/[0.07]",
        divide: "divide-white/[0.07]",
        text: "text-white",
        textSoft: "text-white/65",
        textFaint: "text-white/40",
        input: "bg-black/35 border-white/10 focus:border-emerald-500/60",
        chip: "bg-white/[0.05] border-white/10 text-white/60",
        chipOn: "bg-emerald-500 border-emerald-400 text-black",
        track: "bg-white/10",
        accent: "bg-emerald-500",
        accentSoft: "bg-emerald-500/12 border-emerald-500/25",
        accentText: "text-emerald-300",
        danger: "bg-red-500",
        dangerSoft: "bg-red-500/12 border-red-500/25",
        shadow: "shadow-[0_10px_30px_rgba(0,0,0,0.45)]",
      }
    : {
        screen: "bg-[#eef3f1] text-zinc-900",
        bar: "bg-white/95 border-zinc-900/[0.07]",
        card: "bg-white border-zinc-900/[0.07]",
        cardSoft: "bg-zinc-900/[0.03] border-zinc-900/[0.06]",
        border: "border-zinc-900/[0.08]",
        divide: "divide-zinc-900/[0.08]",
        text: "text-zinc-900",
        textSoft: "text-zinc-600",
        textFaint: "text-zinc-400",
        input: "bg-white border-zinc-300 focus:border-emerald-500/60",
        chip: "bg-zinc-100 border-zinc-200 text-zinc-600",
        chipOn: "bg-emerald-500 border-emerald-500 text-black",
        track: "bg-zinc-900/10",
        accent: "bg-emerald-500",
        accentSoft: "bg-emerald-50 border-emerald-200",
        accentText: "text-emerald-700",
        danger: "bg-red-500",
        dangerSoft: "bg-red-50 border-red-200",
        shadow: "shadow-[0_8px_24px_rgba(15,40,35,0.08)]",
      };
}

/** اهتزاز خفيف يعطي إحساس التطبيق الأصلي (يتجاهل المتصفحات التي لا تدعمه) */
export function haptic(pattern: number | number[] = 8): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* تجاهل */
  }
}
