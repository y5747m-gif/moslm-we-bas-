// يولّد public/downloads/apk-info.json بعد بناء الـ APK
// يُستخدم داخل GitHub Actions (وأي بناء محلي عند توفر Android SDK)
import { statSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apkPath = join(root, "public/downloads/hatsally.apk");
const outPath = join(root, "public/downloads/apk-info.json");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const stat = statSync(apkPath);
const sizeBytes = stat.size;
const sizeLabel =
  sizeBytes > 1024 * 1024
    ? `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;

const [major = 5, minor = 1, patch = 0] = String(pkg.version || "5.1.0")
  .split(".")
  .map((n) => parseInt(n, 10) || 0);
const runNumber = parseInt(process.env.GITHUB_RUN_NUMBER || "0", 10) || 0;
const versionCode = runNumber > 0 ? runNumber : major * 10000 + minor * 100 + patch;

// يمكن للمبنى (CI) تجاوز النسخة/الحد الأدنى بالأحرف البيئية APK_VERSION / APK_MIN_ANDROID
const version = process.env.APK_VERSION || String(pkg.version || "5.1.0");
const minAndroid = process.env.APK_MIN_ANDROID || "7.0 (API 24)";

const info = {
  available: true,
  version,
  versionCode,
  fileName: "hatsally.apk",
  sizeBytes,
  sizeLabel,
  updatedAt: new Date().toISOString(),
  url: "/downloads/hatsally.apk",
  releaseUrl:
    "https://github.com/y5747m-gif/moslm-we-bas-/releases/latest/download/hatsally.apk",
  minAndroid,
  note: "تطبيق هتصلي الأصلي - واجهة أندرويد حقيقية، منبه مربوط بساعة الهاتف ويعمل حتى بعد حذف الإشعار.",
};

writeFileSync(outPath, JSON.stringify(info, null, 2) + "\n");
console.log("✅ apk-info.json written:", info);
