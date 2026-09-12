// يولّد أيقونات الأندرويد وشاشة البداية من أيقونة التطبيق الأساسية
// ويضغط أيقونات الويب لتقليل حجم الموقع وملف APK
import sharp from "sharp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "public/icons/icon-512x512.png");
const res = join(root, "android/app/src/main/res");

const BG = { r: 6, g: 14, b: 13, alpha: 1 }; // #060e0d

// 1) أيقونات اللانشر لكل الكثافات
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, size] of Object.entries(densities)) {
  const dir = join(res, `mipmap-${density}`);
  const buf = await sharp(SRC).resize(size, size, { fit: "cover" }).png({ compressionLevel: 9 }).toBuffer();
  await sharp(buf).toFile(join(dir, "ic_launcher.png"));
  await sharp(buf).toFile(join(dir, "ic_launcher_round.png"));
  await sharp(buf).toFile(join(dir, "ic_launcher_foreground.png"));
  console.log(`✅ mipmap-${density}: ${size}x${size}`);
}

// 2) شاشة البداية (عمودية وأفقية)
async function splash(w, h) {
  const iconSize = Math.min(w, h) * 0.42;
  const icon = await sharp(SRC).resize(Math.round(iconSize), Math.round(iconSize), { fit: "cover" }).png().toBuffer();
  return sharp({ create: { width: w, height: h, channels: 4, background: BG } })
    .composite([{ input: icon, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
const port = await splash(720, 1280);
const land = await splash(1280, 720);
const splashTargets = [
  "drawable/splash.png",
  "drawable-port-mdpi/splash.png", "drawable-port-hdpi/splash.png",
  "drawable-port-xhdpi/splash.png", "drawable-port-xxhdpi/splash.png", "drawable-port-xxxhdpi/splash.png",
];
const landTargets = [
  "drawable-land-mdpi/splash.png", "drawable-land-hdpi/splash.png",
  "drawable-land-xhdpi/splash.png", "drawable-land-xxhdpi/splash.png", "drawable-land-xxxhdpi/splash.png",
];
for (const t of splashTargets) await sharp(port).toFile(join(res, t));
for (const t of landTargets) await sharp(land).toFile(join(res, t));
console.log("✅ splash screens generated");

// 3) ضغط أيقونات الويب (تقليل حجم الموقع و APK)
const webIcons = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-192x192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/icon-512x512.png", 512],
];
for (const [rel, size] of webIcons) {
  const tmp = join(root, rel + ".tmp");
  await sharp(SRC).resize(size, size, { fit: "cover" }).png({ compressionLevel: 9 }).toFile(tmp);
  await sharp(tmp).toFile(join(root, rel));
  const { unlinkSync } = await import("node:fs");
  unlinkSync(tmp);
  console.log(`✅ ${rel}: ${size}x${size}`);
}
console.log("🎉 All Android assets done");
