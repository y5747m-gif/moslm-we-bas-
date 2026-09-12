/**
 * محرك التحقق البصري - هتصلي يعني هتصلي 🔍
 * ----------------------------------------------------------------
 * تحقق حقيقي من صور الإثبات الثلاث:
 *  1) صنبور المياه: معدن + شكل أنبوبي + انعكاسات + سياق مغسلة
 *  2) المصلاة: تناظر + إطار مزخرف + نسيج + ألوان سجاد
 *  3) الوجه: يتم في lib/face.ts (شبكة عصبية حقيقية + فحص العينين)
 *
 * يعمل على بكسلات خام ImageData - بدون DOM - فيعمل في المتصفح
 * ويمكن اختباره في Node. لا توجد عشوائية: نفس الصورة = نفس النتيجة.
 */

export interface PixelImage {
  width: number;
  height: number;
  /** RGBA متتالية */
  data: Uint8ClampedArray | Uint8Array | Uint8ClampedArray<ArrayBuffer>;
}

export interface VisionCheck {
  id: string;
  passed: boolean;
  /** مساهمة الفحص في الدرجة عند النجاح */
  weight: number;
}

export interface ObjectVerifyResult {
  valid: boolean;
  /** 0-100 */
  confidence: number;
  /** 0-100 درجة خام قبل العتبة */
  score: number;
  checks: VisionCheck[];
  /** مفاتيح نصائح للترجمة في الواجهة */
  tips: string[];
  metrics: ImageMetrics;
}

export interface ImageMetrics {
  brightness: number;
  sharpness: number;
  colorfulness: number;
  edgeDensity: number;
  xEdgeDensity: number;
  yEdgeDensity: number;
  metallicRatio: number;
  darkFixtureRatio: number;
  ceramicRatio: number;
  highlightRatio: number;
  coolReflectRatio: number;
  skinRatio: number;
  rugColorRatio: number;
  rugCenterRatio: number;
  meanSat: number;
  lowSatRatio: number;
  metalCenterRatio: number;
  symmetry: number;
  borderTransitions: number;
  textureVar: number;
  blobRatio: number;
  blobAspect: number;
  darkRatio: number;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** حساب كل المقاييس من الصورة - تمريرة واحدة + حواف */
export function computeMetrics(img: PixelImage): ImageMetrics {
  const { width: W, height: H, data } = img;
  const N = W * H;
  const gray = new Float32Array(N);

  let brightSum = 0;
  let metallic = 0;
  let darkFixture = 0;
  let ceramic = 0;
  let highlight = 0;
  let waterTint = 0;
  let skin = 0;
  let rugColor = 0;
  let rugCenter = 0;
  let dark = 0;
  const satArr = new Float32Array(N);
  const centerCount = Math.floor(W * 0.6) * Math.floor(H * 0.7);
  let satSum = 0;
  let lowSat = 0;
  // colorfulness (Hasler-Sutter مختصر)
  let rgSum = 0;
  let ybSum = 0;

  for (let i = 0; i < N; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const br = (r + g + b) / 3;
    gray[i] = br;
    brightSum += br;

    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
    satArr[i] = sat;
    satSum += sat;
    if (sat < 0.25) lowSat++;

    const px = i % W;
    const py = Math.floor(i / W);
    const inCenter = px > W * 0.2 && px < W * 0.8 && py > H * 0.15 && py < H * 0.85;

    // معدن خام (يُصفّى لاحقاً بالتدرج - الكروم يعكس إضاءة متفاوتة)
    if (sat < 0.24 && br >= 55 && br <= 225) metallic++;
    // تركيبات داكنة (صنابير سوداء/برونزية حديثة)
    if (sat < 0.45 && br >= 18 && br < 70) darkFixture++;
    // سيراميك أبيض (مغسلة/بلاط)
    if (br > 200 && sat < 0.25) ceramic++;
    // لمعة انعكاس
    if (br > 236) highlight++;
    // انعكاسات باردة (الكروم يعكس درجات باردة)
    if (b > r + 8 && sat < 0.35 && br >= 70 && br <= 225) waterTint++;
    // بشرة صارمة: هيمنة حمراء قوية (ترفض البلاط البيج والجدران)
    const isSkin =
      r > 90 && g > 35 && b > 15 &&
      r - g > 18 && r - b > 12 &&
      maxC - minC > 18 && sat > 0.14 && sat < 0.8;
    if (isSkin) skin++;
    // ألوان سجاد صارمة: تشبع عالٍ (ترفض البلاط الباهت)
    const isRugRed = r > g + 25 && r > b + 10 && sat > 0.3 && br < 175 && r > 60;
    const isRugGreen = g > r + 12 && g > 45 && sat > 0.3 && br < 170;
    const isRugNavy = b > r + 15 && sat > 0.28 && br < 150 && b > 50;
    const isRugBrown = r > 70 && r > g + 12 && g > b + 5 && sat > 0.3 && br < 150;
    const isRug = isRugRed || isRugGreen || isRugNavy || isRugBrown;
    if (isRug) {
      rugColor++;
      if (inCenter) rugCenter++;
    }
    if (br < 40) dark++;

    const rg = r - g;
    const yb = 0.5 * (r + g) - b;
    rgSum += rg;
    ybSum += yb;
  }

  // حواف Sobel + كثافة أفقية/عمودية + خريطة التدرج
  let xEdges = 0;
  let yEdges = 0;
  let edgeCount = 0;
  const magArr = new Float32Array(N);
  const EDGE_T = 28;
  for (let y = 1; y < H - 1; y++) {
    const row = y * W;
    for (let x = 1; x < W - 1; x++) {
      const i = row + x;
      const gx =
        -gray[i - W - 1] + gray[i - W + 1] +
        -2 * gray[i - 1] + 2 * gray[i + 1] +
        -gray[i + W - 1] + gray[i + W + 1];
      const gy =
        -gray[i - W - 1] - 2 * gray[i - W] - gray[i - W + 1] +
        gray[i + W - 1] + 2 * gray[i + W] + gray[i + W + 1];
      const ax = Math.abs(gx);
      const ay = Math.abs(gy);
      magArr[i] = ax + ay;
      if (ax > EDGE_T * 4) xEdges++;
      if (ay > EDGE_T * 4) yEdges++;
      if (ax + ay > EDGE_T * 6) edgeCount++;
    }
  }

  // معدن مُصفّى بالتدرج: الكروم الحقيقي له انعكاسات متفاوتة (تدرج عالٍ)
  // الجدران والبلاط المسطحة تُرفض حتى لو رمادية
  let gatedMetal = 0;
  let metalCenter = 0;
  let metalCenterN = 0;
  for (let y = 0; y < H; y++) {
    const inCy = y > H * 0.25 && y < H * 0.75;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const br = gray[i];
      const inCx = x > W * 0.25 && x < W * 0.75;
      if (inCx && inCy) metalCenterN++;
      if (satArr[i] < 0.24 && br >= 55 && br <= 225 && magArr[i] > 60) {
        gatedMetal++;
        if (inCx && inCy) metalCenter++;
      }
    }
  }
  metallic = gatedMetal;

  // الحدة: تباين لابلاسيان (عيّنات)
  let lapSum = 0;
  let lapSq = 0;
  let lapN = 0;
  for (let y = 2; y < H - 2; y += 3) {
    const row = y * W;
    for (let x = 2; x < W - 2; x += 3) {
      const i = row + x;
      const lap = gray[i - 1] + gray[i + 1] + gray[i - W] + gray[i + W] - 4 * gray[i];
      lapSum += lap;
      lapSq += lap * lap;
      lapN++;
    }
  }
  const lapMean = lapSum / Math.max(1, lapN);
  const sharpness = Math.max(0, lapSq / Math.max(1, lapN) - lapMean * lapMean);

  // التناظر الأفقي المقاوم للمنظور: مقارنة على نسخة مصغرة (تمويه ضمني)
  // يمتص إمالة التصوير وزاوية السجادة
  const SW = 28;
  const SH = 28;
  const small = new Float32Array(SW * SH);
  const cellW = W / SW;
  const cellH = H / SH;
  for (let sy = 0; sy < SH; sy++) {
    for (let sx = 0; sx < SW; sx++) {
      const x0 = Math.floor(sx * cellW);
      const x1 = Math.min(W, Math.floor((sx + 1) * cellW));
      const y0 = Math.floor(sy * cellH);
      const y1 = Math.min(H, Math.floor((sy + 1) * cellH));
      let s = 0;
      let c = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          s += gray[y * W + x];
          c++;
        }
      }
      small[sy * SW + sx] = s / Math.max(1, c);
    }
  }
  void 0;
  let symDiff = 0;
  let symN = 0;
  for (let sy = 0; sy < SH; sy++) {
    for (let sx = 0; sx < SW / 2; sx++) {
      symDiff += Math.abs(small[sy * SW + sx] - small[sy * SW + (SW - 1 - sx)]);
      symN++;
    }
  }
  const symmetry = clamp01(1 - symDiff / Math.max(1, symN) / 90);

  // حدود السجادة: انتقالات قوية على الصف والعمود الأوسط
  let transitions = 0;
  const midRow = Math.floor(H / 2) * W;
  for (let x = 4; x < W - 4; x += 2) {
    if (Math.abs(gray[midRow + x] - gray[midRow + x - 4]) > 55) transitions++;
  }
  const midCol = Math.floor(W / 2);
  for (let y = 4; y < H - 4; y += 2) {
    if (Math.abs(gray[y * W + midCol] - gray[(y - 4) * W + midCol]) > 55) transitions++;
  }

  // خشونة النسيج: متوسط تباين الكتل
  const BW = 8;
  let texSum = 0;
  let texN = 0;
  for (let by = 0; by < H - BW; by += BW) {
    for (let bx = 0; bx < W - BW; bx += BW) {
      let m = 0;
      let m2 = 0;
      let c = 0;
      for (let y = 0; y < BW; y += 2) {
        for (let x = 0; x < BW; x += 2) {
          const v = gray[(by + y) * W + bx + x];
          m += v;
          m2 += v * v;
          c++;
        }
      }
      m /= c;
      texSum += Math.max(0, m2 / c - m * m);
      texN++;
    }
  }

  // أكبر كتلة معدنية/داكنة متصلة (شبكة 56×56 + BFS)
  const GW = 56;
  const GH = 56;
  const mask = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const sx = Math.floor(((gx + 0.5) / GW) * W);
      const sy = Math.floor(((gy + 0.5) / GH) * H);
      const i = sy * W + sx;
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const br = (r + g + b) / 3;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
      const isMetal = (sat < 0.28 && br >= 55 && br <= 225) || (sat < 0.45 && br >= 18 && br < 70);
      mask[gy * GW + gx] = isMetal ? 1 : 0;
    }
  }
  const seen = new Uint8Array(GW * GH);
  let bestSize = 0;
  let bestAspect = 1;
  const stack: number[] = [];
  for (let s = 0; s < GW * GH; s++) {
    if (!mask[s] || seen[s]) continue;
    let size = 0;
    let minX = GW;
    let maxX = 0;
    let minY = GH;
    let maxY = 0;
    stack.length = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const cur = stack.pop() as number;
      size++;
      const cx = cur % GW;
      const cy = Math.floor(cur / GW);
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;
      if (cx > 0 && mask[cur - 1] && !seen[cur - 1]) { seen[cur - 1] = 1; stack.push(cur - 1); }
      if (cx < GW - 1 && mask[cur + 1] && !seen[cur + 1]) { seen[cur + 1] = 1; stack.push(cur + 1); }
      if (cy > 0 && mask[cur - GW] && !seen[cur - GW]) { seen[cur - GW] = 1; stack.push(cur - GW); }
      if (cy < GH - 1 && mask[cur + GW] && !seen[cur + GW]) { seen[cur + GW] = 1; stack.push(cur + GW); }
    }
    if (size > bestSize) {
      bestSize = size;
      const wBox = maxX - minX + 1;
      const hBox = maxY - minY + 1;
      bestAspect = Math.max(wBox, hBox) / Math.max(1, Math.min(wBox, hBox));
    }
  }

  const inner = (W - 2) * (H - 2);
  return {
    brightness: brightSum / N,
    sharpness,
    colorfulness: (Math.abs(rgSum) + Math.abs(ybSum)) / N,
    edgeDensity: edgeCount / Math.max(1, inner),
    xEdgeDensity: xEdges / Math.max(1, inner),
    yEdgeDensity: yEdges / Math.max(1, inner),
    metallicRatio: metallic / N,
    darkFixtureRatio: darkFixture / N,
    ceramicRatio: ceramic / N,
    highlightRatio: highlight / N,
    coolReflectRatio: waterTint / N,
    skinRatio: skin / N,
    rugColorRatio: rugColor / N,
    rugCenterRatio: rugCenter / Math.max(1, centerCount),
    meanSat: satSum / N,
    lowSatRatio: lowSat / N,
    metalCenterRatio: metalCenter / Math.max(1, metalCenterN),
    symmetry,
    borderTransitions: transitions,
    textureVar: texSum / Math.max(1, texN),
    blobRatio: bestSize / (GW * GH),
    blobAspect: bestAspect,
    darkRatio: dark / N,
  };
}

// ------------------------------------------------------------------
// 🚰 التحقق من صنبور المياه
// ------------------------------------------------------------------
export function verifyWaterTap(m: ImageMetrics, attempt = 0): ObjectVerifyResult {
  const checks: VisionCheck[] = [];
  const tips: string[] = [];
  let score = 0;
  const add = (id: string, passed: boolean, weight: number, tipFail?: string) => {
    checks.push({ id, passed, weight });
    if (passed) score += weight;
    else if (tipFail) tips.push(tipFail);
  };

  const notBlank = m.edgeDensity > 0.012 && m.darkRatio < 0.85;
  add("photo", notBlank && m.brightness > 22 && m.brightness < 238, 8, "tipLight");
  add("sharp", m.sharpness > 25, 9, "tipSteady");

  // معدن بارز قريب (اللقطة البعيدة تُرفض ويُطلب الاقتراب)
  const metalOk = m.metallicRatio > 0.04;
  const darkFixOk = m.darkFixtureRatio > 0.06 && m.metallicRatio > 0.015;
  const materialOk = metalOk || darkFixOk;
  add("metal", materialOk, 26, "tipTapCloser");

  // البصمة اللونية للكروم: مشهد محايد قليل التشبع (يرفض الوجوه والسجاد والغرف)
  const chromeOk = m.meanSat < 0.24 && m.lowSatRatio > 0.55;
  add("chrome", chromeOk, 20, "tipTapOnly");

  // الشكل الأنبوبي: حواف أفقية وعمودية قوية معاً (جسم + ذراع الصنبور)
  const xOk = m.xEdgeDensity > 0.015;
  const yOk = m.yEdgeDensity > 0.015;
  const balance = Math.min(m.xEdgeDensity, m.yEdgeDensity) / Math.max(0.001, Math.max(m.xEdgeDensity, m.yEdgeDensity));
  const shapeOk = xOk && yOk && balance > 0.3 && m.edgeDensity > 0.03;
  add("shape", shapeOk, 15, "tipTapAngle");

  const blobOk = m.blobRatio > 0.015 && m.blobAspect < 6;
  add("solid", blobOk, 10, "tipTapCloser");

  add("shine", m.highlightRatio > 0.0015, 6, "tipTapLight");
  add("sink", m.ceramicRatio > 0.05, 6, "tipTapSink");

  // رفض قاطع: بشرة كثيفة تعني صورة وجه وليست صنبوراً
  if (m.skinRatio > 0.3) {
    score = Math.min(score, 25);
    tips.push("tipNotFace");
  }

  // العتبة التكيفية: 58 ثم تنخفض تدريجياً مع المحاولات (بحد أدنى 42)
  const threshold = Math.max(42, 58 - attempt * 5);
  const coreOk = materialOk && chromeOk && shapeOk && notBlank;
  const valid = score >= threshold && coreOk;
  const confidence = Math.max(5, Math.min(98, Math.round(score)));

  return { valid, confidence, score, checks, tips: [...new Set(tips)].slice(0, 3), metrics: m };
}

// ------------------------------------------------------------------
// 🕌 التحقق من المصلاة / سجادة الصلاة
// ------------------------------------------------------------------
export function verifyPrayerMat(m: ImageMetrics, attempt = 0): ObjectVerifyResult {
  const checks: VisionCheck[] = [];
  const tips: string[] = [];
  let score = 0;
  const add = (id: string, passed: boolean, weight: number, tipFail?: string) => {
    checks.push({ id, passed, weight });
    if (passed) score += weight;
    else if (tipFail) tips.push(tipFail);
  };

  const notBlank = m.edgeDensity > 0.012 && m.darkRatio < 0.85;
  add("photo", notBlank && m.brightness > 22 && m.brightness < 238, 8, "tipLight");
  add("sharp", m.sharpness > 25, 7, "tipSteady");

  // التناظر: أقوى بصمة للسجاد (مقاوم للمنظور)
  const symOk = m.symmetry > 0.5;
  add("symmetry", symOk, 22, "tipMatCenter");

  // ألوان السجاد العميقة في كامل الصورة ومركزها
  const colorOk = m.rugColorRatio > 0.08 && m.rugCenterRatio > 0.08;
  add("colors", colorOk, 20, "tipMatColors");

  // النسيج: زخارف ونقوش كثيفة (يرفض البلاط الأملس)
  const texOk = m.textureVar > 600 && m.edgeDensity > 0.03 && m.edgeDensity < 0.5;
  add("texture", texOk, 16, "tipMatCloser");

  // الإطار: حدود واضحة للسجادة
  const borderOk = m.borderTransitions >= 4;
  add("border", borderOk, 12, "tipMatWhole");

  add("pattern", m.edgeDensity > 0.05, 8, "tipMatCloser");
  add("rich", m.rugColorRatio > 0.3, 7, "tipMatFill");

  // رفض قاطع: كروم طاغٍ يعني صنبوراً وليس سجادة
  // (لا نرفض البشرة هنا: السجاد الأحمر يشبه لون البشرة)
  if (m.metallicRatio > 0.45) {
    score = Math.min(score, 30);
    tips.push("tipNotTap");
  }

  const threshold = Math.max(42, 58 - attempt * 5);
  const coreOk = symOk && colorOk && texOk && notBlank;
  const valid = score >= threshold && coreOk;
  const confidence = Math.max(5, Math.min(98, Math.round(score)));

  return { valid, confidence, score, checks, tips: [...new Set(tips)].slice(0, 3), metrics: m };
}
