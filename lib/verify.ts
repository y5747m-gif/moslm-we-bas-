/**
 * منسق التحقق من صور الإثبات 📷
 * ----------------------------------------------------------------
 * water  → محرك الرؤية: معدن + كروم + شكل أنبوبي
 * prayer → محرك الرؤية: تناظر + ألوان + نسيج سجاد
 * face   → شبكة عصبية: وجه بشري + EAR للعينين (مع بدائل متدرجة)
 */

import {
  computeMetrics,
  verifyWaterTap,
  verifyPrayerMat,
  type PixelImage,
  type VisionCheck,
} from "./vision";
import { analyzeFace, loadFaceEngine, eyeBandHeuristic } from "./face";

export type VerifyTask = "water" | "prayer" | "face";

export interface CaptureVerify {
  valid: boolean;
  confidence: number;
  messageKey: string;
  checks: VisionCheck[];
  tips: string[];
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = dataUrl;
  });
}

function drawSquare(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  // اقتصاص مربع من المنتصف ثم رسم (يحافظ على التناظر)
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas;
}

function toPixelImage(canvas: HTMLCanvasElement): PixelImage {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: imageData.data };
}

/** تسخين محرك الوجه مبكراً (يُستدعى عند بدء الرنين) */
export function warmUpVerification(): void {
  try {
    void loadFaceEngine();
  } catch {
    /* تجاهل */
  }
}

/** بديل: FaceDetector الأصلي + تحليل شريط العين */
async function fallbackFaceDetect(
  img: HTMLImageElement,
  gray: Float32Array,
  W: number,
  H: number
): Promise<{ found: boolean; areaRatio: number; eyesLikely: boolean } | null> {
  try {
    const FD = (window as unknown as { FaceDetector?: new (o?: object) => { detect: (i: unknown) => Promise<Array<{ boundingBox: { width: number; height: number } }>> } }).FaceDetector;
    if (!FD) return null;
    const detector = new FD({ fastMode: false, maxDetectedFaces: 3 });
    const faces = await detector.detect(img);
    if (!faces || faces.length === 0) return { found: false, areaRatio: 0, eyesLikely: false };
    const box = faces[0].boundingBox;
    const areaRatio = (box.width * box.height) / Math.max(1, img.width * img.height);
    const { likely } = eyeBandHeuristic(gray, W, H);
    return { found: true, areaRatio, eyesLikely: likely };
  } catch {
    return null;
  }
}

export async function verifyCapture(
  dataUrl: string,
  task: VerifyTask,
  attempt = 0
): Promise<CaptureVerify> {
  const img = await loadImage(dataUrl);
  const small = drawSquare(img, 224);
  const pixels = toPixelImage(small);
  const metrics = computeMetrics(pixels);

  if (task === "water") {
    const r = verifyWaterTap(metrics, attempt);
    return {
      valid: r.valid,
      confidence: r.confidence,
      messageKey: r.valid ? "msgTapOk" : "msgTapFail",
      checks: r.checks,
      tips: r.tips,
    };
  }

  if (task === "prayer") {
    const r = verifyPrayerMat(metrics, attempt);
    return {
      valid: r.valid,
      confidence: r.confidence,
      messageKey: r.valid ? "msgMatOk" : "msgMatFail",
      checks: r.checks,
      tips: r.tips,
    };
  }

  // ---- الوجه: شبكة عصبية + EAR ----
  const big = drawSquare(img, 480);
  const face = await analyzeFace(big);
  const checks: VisionCheck[] = [];
  const tips: string[] = [];
  let score = 0;
  const add = (id: string, passed: boolean, weight: number, tipFail?: string) => {
    checks.push({ id, passed, weight });
    if (passed) score += weight;
    else if (tipFail) tips.push(tipFail);
  };

  const notBlank = metrics.edgeDensity > 0.012 && metrics.darkRatio < 0.85;
  add("photo", notBlank && metrics.brightness > 22 && metrics.brightness < 238, 8, "tipLight");
  add("sharp", metrics.sharpness > 25, 7, "tipSteady");

  if (!face.engineOk) {
    // المحرك تعذر: جرّب بديل المتصفح
    const N = pixels.width * pixels.height;
    const gray = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      gray[i] = (pixels.data[i * 4] + pixels.data[i * 4 + 1] + pixels.data[i * 4 + 2]) / 3;
    }
    const fb = await fallbackFaceDetect(img, gray, pixels.width, pixels.height);
    if (!fb || !fb.found) {
      add("faceFound", false, 30, "tipFaceCloser");
      add("faceSize", false, 15, "tipFaceCloser");
      add("eyesOpen", false, 40, "tipEyesOpen");
      return { valid: false, confidence: 15, messageKey: "msgFaceNoFace", checks, tips: [...new Set(tips)].slice(0, 3) };
    }
    const sizeOk = fb.areaRatio > 0.02;
    add("faceFound", true, 30);
    add("faceSize", sizeOk, 15, "tipFaceCloser");
    add("eyesOpen", fb.eyesLikely, 40, "tipEyesOpen");
    const valid = fb.eyesLikely && sizeOk && notBlank && score >= 55;
    return {
      valid,
      confidence: Math.min(70, Math.max(20, Math.round(score * 0.8))),
      messageKey: valid ? "msgFaceOk" : fb.eyesLikely ? "msgFaceNoFace" : "msgEyesClosed",
      checks,
      tips: [...new Set(tips)].slice(0, 3),
    };
  }

  if (!face.found) {
    add("faceFound", false, 30, "tipFaceCloser");
    add("faceSize", false, 15, "tipFaceCloser");
    add("eyesOpen", false, 40, "tipEyesOpen");
    return { valid: false, confidence: 12, messageKey: "msgFaceNoFace", checks, tips: [...new Set(tips)].slice(0, 3) };
  }

  const sizeOk = face.areaRatio > 0.02;
  add("faceFound", true, 30);
  add("faceSize", sizeOk, 15, "tipFaceCloser");
  add("eyesOpen", face.eyesOpen, 40, "tipEyesOpen");

  const threshold = Math.max(45, 60 - attempt * 5);
  // العينان المفتوحتان شرط أساسي غير قابل للتنازل
  const valid = face.eyesOpen && sizeOk && notBlank && score >= threshold;
  const confidence = Math.max(5, Math.min(98, Math.round(score * 0.5 + face.confidence * 0.5)));

  let messageKey = "msgFaceOk";
  if (!valid) messageKey = !face.eyesOpen ? "msgEyesClosed" : !sizeOk ? "msgFaceSmall" : "msgFaceFail";

  return { valid, confidence, messageKey, checks, tips: [...new Set(tips)].slice(0, 3) };
}
