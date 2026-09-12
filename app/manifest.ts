import type { MetadataRoute } from "next";

// مطلوب لتصدير نسخة ثابتة (output: export) داخل تطبيق الـ APK
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "هتصلي يعني هتصلي - منبه الفجر الذكي",
    short_name: "هتصلي",
    description: "تم تصميم هذا البرنامج لإيقاظك لصلاة الفجر وجميع الصلوات فلا تنسانا من صالح دعائكم 🤍 - منبه ذكي يناديك باسمك بصوت رجل، يفحص الصور بالذكاء الاصطناعي، ويعمل بدون إنترنت",
    start_url: "/?source=pwa",
    display: "standalone",
    display_override: ["standalone", "window-controls-overlay", "minimal-ui"],
    background_color: "#060e0d",
    theme_color: "#10b981",
    orientation: "portrait-primary",
    scope: "/",
    categories: ["lifestyle", "productivity", "utilities", "health"],
    lang: "ar",
    dir: "rtl",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "اضبط منبه الفجر",
        short_name: "منبه الفجر",
        description: "اضبط منبه جديد لصلاة الفجر",
        url: "/?action=set-alarm&source=shortcut",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "جرّب المنبه الآن",
        short_name: "جرّب الآن",
        description: "جرّب صوت المنبه الذكي",
        url: "/?action=try&source=shortcut",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    screenshots: [
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        form_factor: "narrow",
        label: "هتصلي يعني هتصلي - منبه الفجر",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        form_factor: "wide",
        label: "هتصلي يعني هتصلي - شاشة المنبه",
      },
    ],
    related_applications: [],
    prefer_related_applications: false,
  };
}
