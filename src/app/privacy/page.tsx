import Link from "next/link";
import { MoonStar, ArrowRight, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "سياسة الخصوصية | منبه الفجر",
  description: "سياسة الخصوصية لتطبيق منبه الفجر: بياناتك على جهازك فقط ولا تغادره أبداً.",
};

export default function PrivacyPage() {
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

      <article className="mx-auto max-w-3xl px-4 py-14">
        <div className="mb-8 text-center">
          <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
          <h1 className="text-3xl font-black sm:text-4xl">سياسة الخصوصية</h1>
          <p className="mt-2 text-sm text-slate-400">آخر تحديث: سبتمبر 2026 • الإصدار 1.0.0</p>
        </div>

        <div className="space-y-4 text-sm leading-8 text-slate-200">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5 font-bold text-emerald-200">
            الخلاصة: تطبيق منبه الفجر يعمل كلياً على جهازك (Offline)، ولا يجمع أي بيانات ولا يرسل أي شيء إلى أي مكان — لأنه لا يحتوي على إذن إنترنت أصلاً.
          </div>

          {[
            { t: "1. الكاميرا والصور", d: "تُستخدم الكاميرا فقط داخل شاشة الرنين لالتقاط 3 صور إثبات استيقاظ بضغطتك أنت على زر الالتقاط. تُحفظ الصور في المساحة الخاصة بالتطبيق على جهازك فقط، ويمكنك عرضها وحذفها من داخل التطبيق في أي وقت، وتُحذف نهائياً عند إلغاء تثبيت التطبيق." },
            { t: "2. الإشعارات والمنبه", d: "تُستخدم أذونات الإشعارات والمنبه الدقيق والاهتزاز لتشغيل تنبيه الفجر فقط. لا يقرأ التطبيق إشعارات التطبيقات الأخرى ولا يطلب إذن الوصول إلى الإشعارات إطلاقاً." },
            { t: "3. عدم جمع البيانات", d: "لا نجمع الاسم ولا البريد ولا رقم الهاتف ولا الموقع ولا جهات الاتصال ولا أي معرّف للجهاز. لا توجد حسابات ولا تسجيل دخول ولا تحليلات ولا إعلانات." },
            { t: "4. عدم مشاركة البيانات", d: "لا نشارك أي بيانات مع أي طرف ثالث لأنه لا توجد بيانات تُجمع من الأساس، ولا يوجد اتصال شبكي في التطبيق." },
            { t: "5. سيطرتك الكاملة", d: "يمكنك تعطيل المنبه من داخل التطبيق، وحذف الصور المحفوظة، وإلغاء تثبيت التطبيق في أي وقت — وكل ذلك يوقف كل وظائف التطبيق فوراً." },
            { t: "6. الأطفال", d: "التطبيق أداة منبه عامة ولا يستهدف الأطفال بجمع بيانات، وهو لا يجمع بيانات من أي مستخدم أياً كان عمره." },
            { t: "7. تغييرات السياسة", d: "أي تغيير مستقبلي سيُوضح في هذه الصفحة مع تحديث التاريخ، وسيبقى المبدأ ثابتاً: جهازك أولاً، ولا بيانات تغادر هاتفك." },
          ].map((s, i) => (
            <section key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-1 font-black text-white">{s.t}</h2>
              <p>{s.d}</p>
            </section>
          ))}

          <p className="pt-4 text-center text-slate-400">
            <Link href="/" className="text-amber-300 underline underline-offset-4">العودة للصفحة الرئيسية</Link>
          </p>
        </div>
      </article>
    </main>
  );
}
