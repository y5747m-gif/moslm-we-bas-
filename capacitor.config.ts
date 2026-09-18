import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hatsally.app",
  appName: "هتصلي يعني هتصلي",
  webDir: "out",
  backgroundColor: "#060e0d",
  android: {
    backgroundColor: "#060e0d",
    allowMixedContent: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_launcher",
      iconColor: "#10b981",
      // لا نضع sound هنا: ملف res/raw غير موجود وكان يُنتج تحذيراً،
      // وصوت الرنين الحقيقي يأتي من المحرك الأصلي (AlarmRinger) على قناة
      // STREAM_ALARM بأقصى صوت مع اهتزاز ونداء بالاسم.
    },
    TextToSpeech: {},
  },
};

export default config;
