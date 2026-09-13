#!/usr/bin/env node
// يولّد أيقونات التطبيق (ic_launcher) لكل الكثافات - بدون أي اعتماديات خارجية
// التصميم: مربع زمردي + هلال أبيض + نجمة (هوية مختلفة عن الموقع)
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ------------------------------------------------------------------
// كتابة PNG (IHDR + IDAT + IEND) مع CRC32
// ------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function writePng(file, size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // بدون فلتر
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // عمق 8 بت
  ihdr[9] = 6;  // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(file, png);
  console.log("  ✅", file, `${size}x${size}`);
}

// ------------------------------------------------------------------
// رسم الأيقونة
// ------------------------------------------------------------------
function inRoundedRect(x, y, size, radius) {
  const r = radius;
  const cx = Math.max(r, Math.min(size - r, x));
  const cy = Math.max(r, Math.min(size - r, y));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function makeIcon(size) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.22;
  // الهلال: دائرة كبيرة مركزها (0.44, 0.42) نصف قطرها 0.30
  // نقعها منها دائرة مركزها (0.56, 0.36) نصف قطرها 0.24
  const moonR = size * 0.30;
  const moonCx = size * 0.45;
  const moonCy = size * 0.43;
  const cutR = size * 0.245;
  const cutCx = size * 0.585;
  const cutCy = size * 0.355;
  // النجمة الصغيرة (4 رؤوس)
  const starCx = size * 0.66;
  const starCy = size * 0.63;
  const starR = size * 0.085;

  return (x, y, s) => {
    if (!inRoundedRect(x + 0.5, y + 0.5, s, radius)) return [0, 0, 0, 0];
    // تدرج زمردي عمودي
    const t = y / s;
    let r = Math.round(0x34 + (0x0b - 0x34) * t);
    let g = Math.round(0xd3 + (0x8f - 0xd3) * t);
    let b = Math.round(0x99 + (0x63 - 0x99) * t);

    const dm = Math.hypot(x + 0.5 - moonCx, y + 0.5 - moonCy);
    const dc = Math.hypot(x + 0.5 - cutCx, y + 0.5 - cutCy);
    if (dm <= moonR && dc > cutR) {
      // هلال أبيض مع حافة ناعمة
      const edge = moonR - dm;
      const a = Math.max(0, Math.min(1, edge * 8));
      r = Math.round(r + (255 - r) * a);
      g = Math.round(g + (255 - g) * a);
      b = Math.round(b + (255 - b) * a);
    }

    // نجمة (معين لامع)
    const dsx = (x + 0.5 - starCx) / starR;
    const dsy = (y + 0.5 - starCy) / starR;
    const star = Math.abs(dsx) + Math.abs(dsy);
    if (star <= 1) {
      const a = Math.max(0, Math.min(1, (1 - star) * 4));
      r = Math.round(r + (253 - r) * a);
      g = Math.round(g + (230 - g) * a);
      b = Math.round(b + (138 - b) * a);
    }
    return [r, g, b, 255];
  };
}

// ------------------------------------------------------------------
const targets = [
  ["mipmap-mdpi", 48],
  ["mipmap-hdpi", 72],
  ["mipmap-xhdpi", 96],
  ["mipmap-xxhdpi", 144],
  ["mipmap-xxxhdpi", 192],
];

for (const [dir, size] of targets) {
  const out = join(root, "app/src/main/res", dir, "ic_launcher.png");
  mkdirSync(dirname(out), { recursive: true });
  writePng(out, size, makeIcon(size));
}
console.log("✅ تم توليد أيقونات هتصلي الأصلية");
