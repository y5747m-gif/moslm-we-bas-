import Link from "next/link";
import {
  MoonStar,
  Camera,
  BellRing,
  ShieldCheck,
  Smartphone,
  AlarmClock,
  Images,
  Hand,
  BatteryCharging,
  Lock,
  Trash2,
  Download,
  CircleCheck,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import DownloadButton from "@/components/DownloadButton";

function SectionTitle({ kicker, title, desc }: { kicker: string; title: string; desc?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <p className="mb-2 text-sm font-bold tracking-wide text-amber-400">{kicker}</p>
      <h2 className="text-3xl font-black sm:text-4xl">{title}</h2>
      {desc && <p className="mt-3 leading-8 text-slate-300">{desc}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <main>
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060b18]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950">
              <MoonStar className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-black leading-5">منبه الفجر</p>
              <p className="text-xs text-slate-400">استيقظ لصلاتك • بإرادتك وموافقتك</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-bold text-slate-200 md:flex">
            <a href="#how" className="hover:text-amber-300">كيف يعمل؟</a>
            <a href="#permissions" className="hover:text-amber-300">الأذونات</a>
            <a href="#safety" className="hover:text-amber-300">الأمان</a>
            <a href="#faq" className="hover:text-amber-300">الأسئلة</a>
            <Link href="/download" className="rounded-xl bg-amber-400 px-4 py-2 text-slate-950 hover:bg-amber-300">
              تحميل APK
            </Link>
          </nav>
          <Link href="/download" className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 md:hidden">
            تحميل
          </Link>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="stars relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 pt-16 text-center sm:pt-24">
          <div className="animate-float-slow mb-6 grid h-24 w-24 place-items-center rounded-[2rem] bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-600 text-slate-950 glow-ring">
            <MoonStar className="h-12 w-12" />
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.35] sm:text-6xl sm:leading-[1.3]">
            منبه الفجر الذي <span className="text-amber-400">لا يغلق</span> حتى تثبت أنك استيقظت
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-9 text-slate-300">
            تنبيه قوي بصوت عالٍ واهتزاز وشاشة كاملة فوق القفل — ولا يتوقف إلا بعد
            <b className="text-white"> التقاط 3 صور بالكاميرا </b>
            لتتأكد أنك فعلاً صاحٍ لصلاة الفجر.
          </p>

          <div className="mt-8">
            <DownloadButton variant="large" />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-emerald-300">
              <ShieldCheck className="h-4 w-4" /> بموافقتك الكاملة
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-emerald-300">
              <Lock className="h-4 w-4" /> صورك على جهازك فقط
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-emerald-300">
              <Unplug className="h-4 w-4" /> يعمل بدون إنترنت
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-emerald-300">
              <Trash2 className="h-4 w-4" /> إلغاء وحذف في أي وقت
            </span>
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="how" className="border-t border-white/10 bg-[#0b1428]">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionTitle
            kicker="طريقة العمل"
            title="4 خطوات فقط وتضمن استيقاظك للفجر"
            desc="أنت من يثبّت التطبيق وتمنحه الأذونات بنفسك، وأنت من يضبط الموعد — والتطبيق ينفذ ما اتفقت معه عليه."
          />
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { icon: Download, t: "1. حمّل وثبّت", d: "حمّل ملف APK من هذه الصفحة وثبّته على هاتفك الأندرويد، ثم امنح الأذونات المطلوبة بنفسك." },
              { icon: AlarmClock, t: "2. اضبط موعد الفجر", d: "اختر وقت التنبيه من داخل التطبيق (مرة واحدة أو يومياً)، وفعّل المنبه." },
              { icon: BellRing, t: "3. رنين قوي عند الفجر", d: "صوت عالٍ + اهتزاز + شاشة كاملة تظهر حتى فوق شاشة القفل، ولا تُمسح بمسح الإشعار." },
              { icon: Camera, t: "4. صوّر 3 صور", d: "لن يتوقف التنبيه إلا بعد التقاط 3 صور بالكاميرا — دليل أنك قمت فعلاً من فراشك." },
            ].map((s, i) => (
              <div key={i} className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center transition hover:border-amber-400/40 hover:bg-white/[0.07]">
                <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/15 text-amber-300">
                  <s.icon className="h-7 w-7" />
                </span>
                <h3 className="mb-2 text-lg font-black">{s.t}</h3>
                <p className="text-sm leading-7 text-slate-300">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Why 3 photos ===== */}
      <section className="border-t border-white/10">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-bold tracking-wide text-amber-400">فكرة التحدي</p>
            <h2 className="text-3xl font-black leading-snug sm:text-4xl">لماذا 3 صور؟ ولماذا صعب الإغلاق؟</h2>
            <p className="mt-4 leading-8 text-slate-300">
              أغلبنا يغلق المنبه وهو نصف نائم ثم يكمل النوم. لذلك صُمم هذا التطبيق — <b className="text-white">بطلبك وموافقتك</b> — بحيث لا يكفي لمس زر واحد لإسكاته، بل يجب أن تفتح عينيك وتوجه الكاميرا وتلتقط 3 صور، وهي مهمة بسيطة للمستيقظ ومستحيلة على النائم.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                { icon: Images, t: "عدّاد واضح 1/3 ثم 2/3 ثم 3/3 مع معاينة حيّة للكاميرا أمامك." },
                { icon: Hand, t: "زر الغفوة موجود (5 دقائق) — لأن الإغلاق الصعب لا يعني حبسك." },
                { icon: TriangleAlert, t: "إيقاف طوارئ بالضغط المطوّل + إيقاف تلقائي احترازي بعد 15 دقيقة." },
                { icon: Trash2, t: "تقدر تعطّل المنبه أو تحذف التطبيق نهائياً في أي وقت من الإعدادات." },
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  <span className="text-sm leading-7 text-slate-200">{f.t}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Phone mock */}
          <div className="mx-auto w-full max-w-[300px]">
            <div className="rounded-[2.5rem] border-8 border-slate-700 bg-slate-900 p-4 shadow-2xl">
              <div className="rounded-[1.8rem] bg-gradient-to-b from-[#14213d] to-[#060b18] p-5 text-center">
                <p className="text-xs font-bold text-amber-400">⏰ تنبيه صلاة الفجر</p>
                <p className="mt-1 text-4xl font-black tabular-nums">04:35</p>
                <p className="mt-1 text-xs text-slate-400">حان الآن موعد صلاة الفجر</p>
                <div className="mx-auto mt-4 grid h-36 place-items-center rounded-2xl border border-dashed border-amber-400/40 bg-black/40">
                  <div className="text-center">
                    <Camera className="mx-auto h-8 w-8 text-amber-400" />
                    <p className="mt-1 text-[11px] text-slate-300">معاينة الكاميرا</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2">
                  {[1, 2, 3].map((n) => (
                    <span key={n} className={`grid h-8 w-8 place-items-center rounded-full text-sm font-black ${n <= 2 ? "bg-emerald-500 text-white" : "bg-white/15 text-slate-300"}`}>
                      {n <= 2 ? "✓" : n}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs font-bold text-slate-200">تم التقاط 2 من 3</p>
                <div className="mt-3 rounded-xl bg-amber-400 py-2.5 text-sm font-black text-slate-950">📸 التقاط صورة</div>
                <p className="mt-2 text-[11px] text-slate-400">غفوة 5 دقائق • إيقاف طوارئ (ضغط مطوّل)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Permissions ===== */}
      <section id="permissions" className="border-t border-white/10 bg-[#0b1428]">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionTitle
            kicker="الشفافية أولاً"
            title="الأذونات التي يطلبها التطبيق — ولماذا؟"
            desc="كل إذن له سبب واضح مرتبط بوظيفة المنبه فقط، وأنت من يمنحه يدوياً من إعدادات هاتفك."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { icon: Camera, t: "الكاميرا", d: "لالتقاط صور إثبات الاستيقاظ الثلاث أثناء رنين المنبه فقط، مع معاينة ظاهرة أمامك. لا يعمل في الخلفية أبداً.", need: true },
              { icon: BellRing, t: "الإشعارات والتنبيه", d: "لعرض تنبيه الرنين بشاشة كاملة فوق القفل مع صوت واهتزاز. الإشعار مستمر أثناء الرنين فقط (سلوك المنبه الطبيعي) ويختفي فور إيقافه.", need: true },
              { icon: AlarmClock, t: "المنبه الدقيق", d: "ليستيقظ الهاتف ويرن في الموعد المضبوط تماماً حتى في وضع توفير الطاقة.", need: true },
              { icon: BatteryCharging, t: "العمل عند إعادة التشغيل", d: "لإعادة جدولة منبه الفجر تلقائياً إذا أعدت تشغيل هاتفك، حتى لا يفوتك الفجر.", need: false },
            ].map((p, i) => (
              <div key={i} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="mb-3 flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400/15 text-amber-300">
                    <p.icon className="h-6 w-6" />
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${p.need ? "bg-amber-400/15 text-amber-300" : "bg-white/10 text-slate-300"}`}>
                    {p.need ? "أساسي" : "اختياري"}
                  </span>
                </div>
                <h3 className="mb-1 text-lg font-black">{p.t}</h3>
                <p className="text-sm leading-7 text-slate-300">{p.d}</p>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-6 max-w-3xl rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6 text-center">
            <p className="flex items-center justify-center gap-2 text-lg font-black text-emerald-300">
              <ShieldCheck className="h-6 w-6" /> ما لا يطلبه التطبيق أبداً
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-200">
              لا نطلب <b>الوصول إلى إشعاراتك</b> ولا قراءة رسائلك، ولا نطلب جهات الاتصال أو الموقع أو الذاكرة المشتركة،
              ولا يوجد في التطبيق <b>إذن إنترنت أصلاً</b> — أي أن صورك وبياناتك يستحيل أن تغادر جهازك.
            </p>
          </div>
        </div>
      </section>

      {/* ===== Safety ===== */}
      <section id="safety" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionTitle kicker="أمانك وسيطرتك" title="أنت المسيطر دائماً — وليس التطبيق" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Hand, t: "إيقاف الطوارئ", d: "ضغطة مطوّلة 5 ثوانٍ على زر الطوارئ توقف الرنين فوراً في أي ظرف." },
              { icon: AlarmClock, t: "إيقاف احترازي", d: "إذا لم تكمل التحدي خلال 15 دقيقة يتوقف الصوت تلقائياً حفاظاً عليك وعلى من حولك." },
              { icon: Smartphone, t: "إلغاء سهل", d: "زر واضح داخل التطبيق لتعطيل المنبه نهائياً متى شئت." },
              { icon: Trash2, t: "حذف كامل", d: "إلغاء تثبيت عادي من هاتفك يزيل التطبيق وصوره نهائياً، بدون أي بقايا." },
            ].map((s, i) => (
              <div key={i} className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
                <s.icon className="mx-auto mb-3 h-8 w-8 text-amber-400" />
                <h3 className="mb-1 font-black">{s.t}</h3>
                <p className="text-sm leading-7 text-slate-300">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Download CTA ===== */}
      <section className="border-t border-white/10 bg-gradient-to-b from-[#0b1428] to-[#060b18]">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <Smartphone className="mx-auto mb-4 h-12 w-12 text-amber-400" />
          <h2 className="text-3xl font-black sm:text-4xl">حمّل منبه الفجر الآن</h2>
          <p className="mx-auto mt-3 max-w-xl leading-8 text-slate-300">
            ملف APK مباشر لهاتفك الأندرويد. بعد التثبيت اتبع خطوات منح الأذونات من
            <Link href="/download" className="text-amber-300 underline underline-offset-4"> صفحة التحميل </Link>
            ثم اضبط موعدك — وتقبل الله منك.
          </p>
          <div className="mt-8">
            <DownloadButton />
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="border-t border-white/10">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <SectionTitle kicker="أسئلة شائعة" title="عندك سؤال؟" />
          <div className="space-y-3">
            {[
              { q: "هل التطبيق يصورني بدون علمي؟", a: "إطلاقاً. الكاميرا لا تعمل إلا داخل شاشة الرنين وأمام عينيك مع معاينة حيّة وعدّاد واضح، وأنت من يضغط زر الالتقاط بنفسك 3 مرات." },
              { q: "أين تُحفظ الصور؟", a: "في الذاكرة الخاصة بالتطبيق على جهازك فقط، وتقدر تشاهدها وتحذفها من داخل التطبيق. لا يوجد إذن إنترنت في التطبيق أصلاً فلا يمكن إرسالها لأي مكان." },
              { q: "ماذا لو مسحت الإشعار أثناء الرنين؟", a: "إشعار الرنين مستمر (مثل أي منبه) ولا يُمسح بالسحب أثناء الرنين، ويختفي تلقائياً فور إيقاف المنبه بإكمال الصور الثلاث أو الغفوة أو إيقاف الطوارئ." },
              { q: "هل أستطيع إلغاء المنبه إذا غيّرت رأيي؟", a: "نعم، في أي وقت: زر تعطيل داخل التطبيق، أو إلغاء التثبيت العادي من هاتفك يزيل كل شيء." },
              { q: "لماذا التثبيت عبر APK وليس متجر Play؟", a: "هذه النسخة الأولى توزع مباشرة من موقعنا. ثبّتها بالسماح بالتثبيت من هذا المصدر مرة واحدة من إعدادات هاتفك (خطوات مصورة في صفحة التحميل)." },
              { q: "هل يعمل بدون إنترنت؟", a: "نعم 100%. المنبه والكاميرا والصور كلها محلية على جهازك ولا تحتاج أي اتصال." },
            ].map((f, i) => (
              <details key={i} className="group rounded-2xl border border-white/10 bg-white/5 p-5 open:border-amber-400/40">
                <summary className="flex cursor-pointer items-center justify-between gap-3 font-black">
                  {f.q}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-400/15 text-amber-300 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-slate-300">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-white/10 bg-[#04070f]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-center sm:flex-row sm:text-right">
          <div className="flex items-center gap-2">
            <MoonStar className="h-5 w-5 text-amber-400" />
            <p className="text-sm text-slate-300">منبه الفجر — صُنع ليعينك على طاعة الله</p>
          </div>
          <div className="flex items-center gap-4 text-sm font-bold text-slate-300">
            <Link href="/download" className="hover:text-amber-300">التحميل</Link>
            <Link href="/privacy" className="hover:text-amber-300">الخصوصية</Link>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <CircleCheck className="h-3.5 w-3.5" /> يعمل دون إنترنت
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
