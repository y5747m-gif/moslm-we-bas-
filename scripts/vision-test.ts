// اختبار محرك الرؤية على صور حقيقية: npx tsx scripts/vision-test.ts
import sharp from "sharp";
import { computeMetrics, verifyWaterTap, verifyPrayerMat, type PixelImage } from "../lib/vision";

const SIZE = 224;

async function loadImage(path: string, blur = 0): Promise<PixelImage> {
  let s = sharp(path).resize(SIZE, SIZE, { fit: "fill" }).removeAlpha();
  if (blur > 0) s = s.blur(blur);
  const buf = await s.raw().toBuffer();
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4] = buf[i * 3];
    data[i * 4 + 1] = buf[i * 3 + 1];
    data[i * 4 + 2] = buf[i * 3 + 2];
    data[i * 4 + 3] = 255;
  }
  return { width: SIZE, height: SIZE, data };
}

const cases: Array<{ file: string; expectWater: boolean; expectMat: boolean; blur?: number }> = [
  { file: "img-faucet-close.png", expectWater: true, expectMat: false },
  // اللقطة البعيدة تُرفض عمداً ويُطلب الاقتراب (إثبات أقوى)
  { file: "img-faucet-wide.png", expectWater: false, expectMat: false },
  { file: "img-mat-close.png", expectWater: false, expectMat: true },
  { file: "img-mat-floor.png", expectWater: false, expectMat: true },
  { file: "img-mat-mosque.png", expectWater: false, expectMat: true },
  { file: "img-neg-wall.png", expectWater: false, expectMat: false },
  { file: "img-neg-room.png", expectWater: false, expectMat: false },
  { file: "img-neg-street.png", expectWater: false, expectMat: false },
  { file: "img-face-open.png", expectWater: false, expectMat: false },
  { file: "img-face-closed.png", expectWater: false, expectMat: false },
  { file: "img-faucet-close.png", expectWater: false, expectMat: false, blur: 10 },
];

function fmt(n: number, d = 3): string {
  return Number(n.toFixed(d)).toString();
}

async function main() {
  let pass = 0;
  let fail = 0;
  for (const c of cases) {
    const label = c.blur ? `${c.file} (BLUR${c.blur})` : c.file;
    const img = await loadImage(`vision-test/${c.file}`, c.blur || 0);
    const m = computeMetrics(img);
    const w = verifyWaterTap(m, 0);
    const p = verifyPrayerMat(m, 0);
    const wOk = w.valid === c.expectWater;
    const pOk = p.valid === c.expectMat;
    if (wOk && pOk) pass++;
    else fail++;
    console.log(`\n${wOk && pOk ? "✅" : "❌"} ${label}`);
    console.log(`  water: score=${w.score} valid=${w.valid} (expect ${c.expectWater}) checks=${w.checks.map((x) => `${x.id}${x.passed ? "✓" : "✗"}`).join(" ")}`);
    console.log(`  mat:   score=${p.score} valid=${p.valid} (expect ${c.expectMat}) checks=${p.checks.map((x) => `${x.id}${x.passed ? "✓" : "✗"}`).join(" ")}`);
    console.log(`  metrics: bright=${fmt(m.brightness, 1)} sharp=${fmt(m.sharpness, 1)} edge=${fmt(m.edgeDensity)} xE=${fmt(m.xEdgeDensity)} yE=${fmt(m.yEdgeDensity)} metal=${fmt(m.metallicRatio)} darkFix=${fmt(m.darkFixtureRatio)} ceram=${fmt(m.ceramicRatio)} shine=${fmt(m.highlightRatio, 4)} cool=${fmt(m.coolReflectRatio)} skin=${fmt(m.skinRatio)} rug=${fmt(m.rugColorRatio)} rugC=${fmt(m.rugCenterRatio)} sym=${fmt(m.symmetry)} trans=${m.borderTransitions} tex=${fmt(m.textureVar, 1)} blob=${fmt(m.blobRatio)} aspect=${fmt(m.blobAspect, 2)} mSat=${fmt(m.meanSat)} lowSat=${fmt(m.lowSatRatio)} mCntr=${fmt(m.metalCenterRatio)} dark=${fmt(m.darkRatio)}`);
  }
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
}

main();
