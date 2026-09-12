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
      sound: "beep.wav",
    },
    TextToSpeech: {},
  },
};

export default config;
