import Link from "next/link";
import {
  MoonStar,
  Download,
  Settings,
  Camera,
  BellRing,
  AlarmClock,
  CircleCheck,
  ArrowRight,
  FileDown,
  ShieldCheck,
} from "lucide-react";
import DownloadButton from "@/components/DownloadButton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "تحميل التطبيق | منبه الفجر",
  description: "حمّل ملف APK لمنبه الفجر وثبّته على هاتفك خطوة بخطوة مع شرح منح الأذونات.",
};

const steps = [
  {
    icon: FileDown,
    title: "الخطوة 1: تحميل ملف APK",
    points: [
      "اضغط زر التحميل بالأعلى — سيتم تنزيل ملف fajr-alarm.apk على هاتفك.",
      "يُنصح بالتحميل من متصفح الهاتف مباشرة (كروم) لتسهيل التثبيت.",
      "حجم الملف صغير (بضعة ميجابايت) ولا يحتاج إنترنت بعد التثبيت.",
    ],
  },
  {
    icon: Settings,
    title: "الخطوة 2: السماح بالتثبيت",
    points: [
      "افتح الملف من شريط التنزيلات، وسيطلب هاتفك السماح بالتثبيت من هذا المصدر — اضغط (سماح / تثبيت على أي حال).",
      "هذه رسالة طبيعية لأي تطبيق خارج متجر Play، وملفنا يُبنى علناً من كود مفتوح.",
      "بعد اكتمال التثبيت ستجد أيقونة (منبه الفجر 🌙) في تطبيقاتك.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "الخطوة 3: منح الأذونات (بموافقتك)",
    points: [
      "افتح التطبيق وستظهر لك بطاقات الأذونات واحدة واحدة — امنحها بنفسك بالضغط عليها.",
      "الكاميرا: لالتقاط صور إثبات الاستيقاظ أثناء الرنين فقط.",
      "الإشعارات: لعرض تنبيه الرنين فوق القفل مع الصوت والاهتزاز.",
      "المنبه الدقيق: ليرن الهاتف في الموعد تماماً حتى في وضع توفير الطاقة.",
    ],
  },
  {
    icon: AlarmClock,
    title: "الخطوة 4: اضبط موعد الفجر وفعّل",
    points: [
      "اختر وقت التنبيه من داخل التطبيق وفعّل مفتاح المنبه.",
      "جرّب زر (اختبار المنبه) مرة واحدة نهاراً لتتأكد أن الصوت والكاميرا يعملان.",
      "نم مطمئناً — سيرن المنبه ولن يسكت إلا بعد صورك الثلاث 📸📸📸",
    ],
  },
];

export default function DownloadPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-white/10 bg-[#060b18]/85">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950">
              <MoonStar className="h-6 w-6" />
            </span>
            <p className="text-lg font-black">منبه الفجر</p>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-slate-300 hover:text-amber-300">
            العودة للرئيسية <ArrowRight className="h-4 w-4 rotate-180" />
          </Link>
        </div>
      </header>

      <section className="stars">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center">
          <Download className="mx-auto mb-4 h-12 w-12 text-amber-400" />
          <h1 className="text-3xl font-black sm:text-5xl">تحميل منبه الفجر (APK)</h1>
          <p className="mx-auto mt-3 max-w-xl leading-8 text-slate-300">
            حمّل التطبيق مباشرة على هاتفك الأندرويد، ثم اتبع الخطوات الأربع بالأسفل —
            التثبيت يستغرق أقل من دقيقتين.
          </p>
          <div className="mt-8">
            <DownloadButton variant="large" />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-300">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Camera className="h-3.5 w-3.5 text-amber-300" /> كاميرا قوية</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><BellRing className="h-3.5 w-3.5 text-amber-300" /> تنبيه فوق القفل</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><AlarmClock className="h-3.5 w-3.5 text-amber-300" /> منبه دقيق</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><CircleCheck className="h-3.5 w-3.5 text-emerald-300" /> بدون إنترنت</span>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0b1428]">
        <div className="mx-auto max-w-4xl space-y-4 px-4 py-14">
          {steps.map((s, i) => (
            <div key={i} className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-400/15 text-amber-300">
                  <s.icon className="h-6 w-6" />
                </span>
                <h2 className="text-xl font-black">{s.title}</h2>
              </div>
              <ul className="space-y-2.5">
                {s.points.map((p, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm leading-7 text-slate-200">
                    <CircleCheck className="mt-1.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-6 text-center sm:p-8">
            <h2 className="text-xl font-black text-amber-300">ملاحظة مهمة عن أجهزة شاومي وهواوي وأوبو</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-slate-200">
              بعض الأجهزة تغلق التطبيقات في الخلفية تلقائياً. بعد التثبيت افتح: الإعدادات ← البطارية ←
              اختر (منبه الفجر) ← (عدم التقييد / السماح بالعمل في الخلفية)، وفعّل (التشغيل التلقائي) إن وُجد —
              وستجد زراً داخل التطبيق يأخذك لهذه الشاشة مباشرة.
            </p>
          </div>

          <p className="pt-2 text-center text-sm text-slate-400">
            واجهت مشكلة؟ راجع <Link href="/#faq" className="text-amber-300 underline underline-offset-4">الأسئلة الشائعة</Link> أو
            أعد تثبيت آخر إصدار من هذه الصفحة.
          </p>
        </div>
      </section>
    </main>
  );
}
