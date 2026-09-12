import { headers } from "next/headers";
import { statSync, existsSync } from "fs";
import path from "path";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

const APK_PATH = path.join(process.cwd(), "public", "apk", "iqaz-alfajr.apk");

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} ميجابايت` : `${Math.max(1, Math.round(bytes / 1024))} كيلوبايت`;
}

async function getSiteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/`;
}

export default async function Home() {
  const apkExists = existsSync(APK_PATH);
  const apkSize = apkExists ? statSync(APK_PATH).size : 0;
  const siteUrl = await getSiteUrl();
  const apkUrl = new URL("/apk/iqaz-alfajr.apk", siteUrl).toString();

  const qrSvg = await QRCode.toString(siteUrl, {
    type: "svg",
    margin: 1,
    width: 220,
    color: { dark: "#0A2E2B", light: "#F5F1E6" },
  });

  const features = [
    {
      icon: "🔔",
      title: "منبه لا يصمت إلا منك",
      desc: "يرن حتى تفتح شاشة المنبه وتضغط «أوقف المنبه» بنفسك — لا زر صدّاد في الإشعار.",
    },
    {
      icon: "🔒",
      title: "يظهر فوق شاشة القفل",
      desc: "شاشة كاملة تُشغّل الجهاز وتضيء الشاشة مع بيان آية: ﴿إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا﴾.",
    },
    {
      icon: "📡",
      title: "حساب فلكي بلا إنترنت",
      desc: "مواقيت الفجر تُحسب داخل هاتفك خوارزميًا (أم القرى، رابطة العالم، الهيئة المصرية…) — لا يتصل التطبيق بالشبكة إطلاقًا.",
    },
    {
      icon: "🔊",
      title: "أذان من هاتفك",
      desc: "اختر ملف أذان من ذاكرتك ليكون صوت الإيقاظ، أو استخدم النغمة الافتراضية أو الاهتزاز فقط.",
    },
    {
      icon: "⏰",
      title: "منبه احتياطي وغفوة محدودة",
      desc: "إن غفوت بعد الرنين الأول يعود المنبه بعد ١٠ دقائق، والغفوة لا تتجاوز ٣ مرات حتى لا يفوتك الفجر.",
    },
    {
      icon: "🔋",
      title: "يعمل بعد إعادة التشغيل",
      desc: "يُعاد ضبط المنبه تلقائيًا بعد إعادة تشغيل الهاتف أو تحديثه، ومع تعويض إن فات المنبه.",
    },
  ];

  const steps = [
    {
      n: "١",
      title: "نزّل ملف APK",
      desc: "اضغط زر التنزيل أعلاه أو امسح رمز QR بكاميرا هاتفك ثم افتح الرابط.",
    },
    {
      n: "٢",
      title: "اسمح بالتثبيت",
      desc: "سيطلب أندرويد «السماح من هذا المصدر» — وافق مرة واحدة، فهذا ملف التطبيق نفسه.",
    },
    {
      n: "٣",
      title: "افتح التطبيق وامنح الأذونات",
      desc: "من بطاقة «الصلاحيات» امنح: الإشعارات، الظهور فوق شاشة القفل، وتجاهل تحسين البطارية — كل إذن بضغطة منك.",
    },
    {
      n: "٤",
      title: "فعّل منبه الفجر",
      desc: "اختر مدينتك وصوت الأذان ثم اضغط «تفعيل منبه الفجر اليومي» — وستُوقظ كل يوم في وقته.",
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-5 pb-16">
      {/* الترويسة */}
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2 text-2xl font-extrabold text-[var(--accent)]">
          🕌 إيقاظ الفجر
        </div>
        <span className="rounded-full border border-[var(--stroke)] px-3 py-1 text-xs text-[var(--dim)]">
          بلا إنترنت · بلا إعلانات · بلا تتبع
        </span>
      </header>

      {/* البطل: التنزيل + QR */}
      <section className="card p-7 text-center">
        <h1 className="mb-3 text-3xl font-extrabold leading-snug sm:text-4xl">
          يوقظك كل يوم <span className="text-[var(--accent)]">لصلاة الفجر</span>
        </h1>
        <p className="mx-auto mb-7 max-w-xl text-[var(--dim)]">
          منبّه أندرويد مجاني يرنّ في وقته، يُشغّل الشاشة فوق القفل، ولا يصمت إلا
          بعد أن تستيقظ — وكل صلاحية فيه تُمنح منك أنت.
        </p>

        <div className="grid items-center gap-6 sm:grid-cols-2">
          {/* بطاقة التنزيل */}
          <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--bg-soft)] p-6">
            <div className="mb-1 text-5xl">📱</div>
            <div className="mb-1 font-extrabold text-[var(--text)]">
              iqaz-alfajr.apk
            </div>
            <div className="mb-4 text-xs text-[var(--dim)]">
              الإصدار 1.0 · أندرويد 8.0+ ·{" "}
              {apkExists ? formatSize(apkSize) : "قيد البناء"}
            </div>

            {apkExists ? (
              <a
                href="/apk/iqaz-alfajr.apk"
                download="iqaz-alfajr.apk"
                className="gold-btn inline-block w-full px-6 py-3.5 text-lg"
              >
                ⬇️ تنزيل التطبيق
              </a>
            ) : (
              <div className="rounded-full bg-[var(--card)] px-4 py-3 text-sm text-[var(--dim)]">
                جارٍ بناء الإصدار الأول… حدِّث الصفحة بعد قليل
              </div>
            )}

            {apkExists && (
              <a
                href={apkUrl}
                className="mt-3 inline-block text-xs text-[var(--dim)] underline decoration-dotted"
              >
                فتح الرابط المباشر للملف
              </a>
            )}
          </div>

          {/* رمز QR */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="qr-box"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="text-sm text-[var(--dim)]">
              امسح الرمز بكاميرا الهاتف
              <br />
              <span className="text-xs opacity-70 break-all">{siteUrl}</span>
            </p>
          </div>
        </div>
      </section>

      <div className="star-divider my-10 text-xl">✦ ✦ ✦</div>

      {/* خطوات التثبيت */}
      <section>
        <h2 className="mb-6 text-center text-2xl font-extrabold">
          كيف تُثبّته على هاتفك؟
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="card flex gap-4 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xl font-extrabold text-[#082724]">
                {s.n}
              </div>
              <div>
                <h3 className="mb-1 font-extrabold text-[var(--text)]">
                  {s.title}
                </h3>
                <p className="text-sm text-[var(--dim)]">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="star-divider my-10 text-xl">✦ ✦ ✦</div>

      {/* المزايا */}
      <section>
        <h2 className="mb-6 text-center text-2xl font-extrabold">
          لماذا «إيقاظ الفجر»؟
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card p-5">
              <div className="mb-2 text-3xl">{f.icon}</div>
              <h3 className="mb-1 font-extrabold text-[var(--accent)]">
                {f.title}
              </h3>
              <p className="text-sm text-[var(--dim)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="star-divider my-10 text-xl">✦ ✦ ✦</div>

      {/* الخصوصية والأذونات */}
      <section className="card p-7">
        <h2 className="mb-4 text-center text-2xl font-extrabold">
          الأذونات والخصوصية — أنت من يقرر
        </h2>
        <p className="mb-5 text-center text-sm text-[var(--dim)]">
          التطبيق لا يطلب أي إذن عند التثبيت؛ بل تعرض الشاشة الرئيسية بطاقة
          «الصلاحيات» وتمنح كل إذن بضغطة زر ومتى شئت.
        </p>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--stroke)] p-4">
            <b className="text-[var(--text)]">🔔 الإشعارات</b>
            <p className="text-[var(--dim)]">
              لإظهار تنبيه الفجر (يمنحه المستخدم من أندرويد 13).
            </p>
          </div>
          <div className="rounded-xl border border-[var(--stroke)] p-4">
            <b className="text-[var(--text)]">🔒 فوق شاشة القفل</b>
            <p className="text-[var(--dim)]">
              لعرض شاشة المنبه كاملةً عند القفل وتشغيل الشاشة.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--stroke)] p-4">
            <b className="text-[var(--text)]">🔋 تجاهل تحسين البطارية</b>
            <p className="text-[var(--dim)]">
              حتى لا يؤخّر النظام المنبه في وضع الاستعداد (موصى به).
            </p>
          </div>
          <div className="rounded-xl border border-[var(--stroke)] p-4">
            <b className="text-[var(--text)]">📍 الموقع (اختياري)</b>
            <p className="text-[var(--dim)]">
              لحساب الفجر في موقعك بدقة — لا يُرسل لأي جهة، ويمكن اختيار المدينة
              يدويًا بدلًا منه.
            </p>
          </div>
        </div>
        <p className="mt-5 rounded-xl bg-[var(--bg-soft)] p-4 text-center text-sm text-[var(--green)]">
          ✅ لا وصول للإنترنت نهائيًا · لا جمع بيانات · لا إعلانات — الملف موقّع
          ويمكنك فحص الصلاحيات قبل منحها
        </p>
      </section>

      <footer className="mt-12 text-center text-xs text-[var(--dim)]">
        <p className="mb-1">﴿حَافِظُوا عَلَى الصَّلَوَاتِ وَالصَّلَاةِ الْوُسْطَى﴾</p>
        <p>إيقاظ الفجر · تطبيق مجاني لوجه الله تعالى · نُشر عبر موقع الويب مباشرة</p>
      </footer>
    </main>
  );
}
