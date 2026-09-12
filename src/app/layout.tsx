import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "منبه الفجر | استيقظ لصلاة الفجر",
  description:
    "تطبيق منبه صلاة الفجر: تنبيه قوي لا يتوقف إلا بعد التقاط 3 صور لإثبات الاستيقاظ. بموافقتك الكاملة، وصورك تبقى على جهازك فقط.",
  keywords: ["منبه الفجر", "صلاة الفجر", "منبه الصلاة", "Fajr alarm"],
  robots: "index, follow",
};

export const viewport: Viewport = {
  themeColor: "#060b18",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
