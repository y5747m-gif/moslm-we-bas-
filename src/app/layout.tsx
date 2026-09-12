import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "إيقاظ الفجر — منبّه صلاة الفجر",
  description:
    "تطبيق أندرويد يوقظك يوميًا لصلاة الفجر: منبه كامل الشاشة فوق القفل، حساب فلكي بلا إنترنت، وأنت من يمنح كل إذن. نزّل ملف APK من الموقع مباشرة.",
};

export const viewport: Viewport = {
  themeColor: "#0A2E2B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
