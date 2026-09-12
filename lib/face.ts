/**
 * كشف الوجه والعينين - شبكة عصبية حقيقية 👁️
 * ----------------------------------------------------------------
 * يستخدم نموذجين صغيرين يعملان على الهاتف بدون إنترنت:
 *  - tiny_face_detector (193KB): العثور على الوجوه
 *  - face_landmark_68_tiny (77KB): 68 نقطة معالم للوجه
 * ثم يحسب نسبة فتح العين EAR لكل عين للتأكد أن العينين مفتوحتان.
 *
 * النماذج مضمّنة في public/models وتُحمّل كسولاً عند الحاجة فقط.
 */

import type * as faceapiTypes from "@vladmandic/face-api";

type FaceApi = typeof faceapiTypes;

let api: FaceApi | null = null;
let ready = false;
let loadPromise: Promise<boolean> | null = null;

export function isFaceEngineReady(): boolean {
  return ready && !!api;
}

/** تحميل محرك الوجه (آمن للتكرار) */
export function loadFaceEngine(): Promise<boolean> {
  if (ready && api) return Promise.resolve(true);
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const mod = (await import("@vladmandic/face-api")) as unknown as FaceApi;
      api = mod;
      await api.nets.tinyFaceDetector.loadFromUri("/models");
      const tinyNet = api.nets as unknown as {
        faceLandmark68TinyNet: { loadFromUri: (u: string) => Promise<void> };
      };
      await tinyNet.faceLandmark68TinyNet.loadFromUri("/models");
      ready = true;
      console.log("🤖 Face engine ready (tiny detector + tiny landmarks, offline)");
      return true;
    } catch (e) {
      console.warn("[face] engine load failed:", e);
      loadPromise = null;
      api = null;
      return false;
    }
  })();
  return loadPromise;
}

export interface EyeState {
  earLeft: number;
  earRight: number;
  eyesOpen: boolean;
}

export interface FaceAnalysis {
  engineOk: boolean;
  found: boolean;
  count: number;
  /** نسبة مساحة الوجه من الصورة */
  areaRatio: number;
  detectionScore: number;
  earLeft: number;
  earRight: number;
  eyesOpen: boolean;
  /** 0-100 */
  confidence: number;
}

function dist(
  p: ArrayLike<{ x: number; y: number }>,
  a: number,
  b: number
): number {
  const dx = p[a].x - p[b].x;
  const dy = p[a].y - p[b].y;
  return Math.sqrt(dx * dx + dy * dy) || 0.0001;
}

/**
 * نسبة فتح العين EAR:
 * عين مفتوحة ≈ 0.25-0.35 | نصف مغمضة ≈ 0.18-0.22 | مغلقة < 0.15
 */
export function eyeAspectRatio(
  pts: ArrayLike<{ x: number; y: number }>,
  eye: [number, number, number, number, number, number]
): number {
  const vertical = dist(pts, eye[1], eye[5]) + dist(pts, eye[2], eye[4]);
  const horizontal = 2 * dist(pts, eye[0], eye[3]);
  return vertical / horizontal;
}

export function classifyEyes(earLeft: number, earRight: number): EyeState {
  const avg = (earLeft + earRight) / 2;
  const min = Math.min(earLeft, earRight);
  // صارم لكن عادل: كلتا العينين مفتوحتان بوضوح
  const eyesOpen = min > 0.18 && avg > 0.21;
  return { earLeft, earRight, eyesOpen };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("face timeout")), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      }
    );
  });
}

/** تحليل صورة وجه: هل يوجد وجه بشري؟ وهل العينان مفتوحتان؟ */
export async function analyzeFace(
  canvas: HTMLCanvasElement,
  timeoutMs = 25000
): Promise<FaceAnalysis> {
  const fail: FaceAnalysis = {
    engineOk: false,
    found: false,
    count: 0,
    areaRatio: 0,
    detectionScore: 0,
    earLeft: 0,
    earRight: 0,
    eyesOpen: false,
    confidence: 0,
  };
  const ok = await loadFaceEngine();
  if (!ok || !api) return fail;
  try {
    const options = new api.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.35,
    });
    const results = await withTimeout(
      api
        .detectAllFaces(canvas, options)
        .withFaceLandmarks(true) as unknown as Promise<
        Array<{
          detection: { score: number; box: { width: number; height: number } };
          landmarks: { positions: Array<{ x: number; y: number }> };
        }>
      >,
      timeoutMs
    );
    if (!results || results.length === 0) {
      return { ...fail, engineOk: true };
    }
    // أكبر وجه = الأقرب للكاميرا
    let best = results[0];
    let bestArea = 0;
    for (const r of results) {
      const a = r.detection.box.width * r.detection.box.height;
      if (a > bestArea) {
        bestArea = a;
        best = r;
      }
    }
    const canvasArea = Math.max(1, canvas.width * canvas.height);
    const areaRatio = bestArea / canvasArea;
    const pts = best.landmarks.positions;
    const earLeft = eyeAspectRatio(pts, [36, 37, 38, 39, 40, 41]);
    const earRight = eyeAspectRatio(pts, [42, 43, 44, 45, 46, 47]);
    const { eyesOpen } = classifyEyes(earLeft, earRight);

    // الثقة: دقة الكشف + هامش فتح العين + حجم الوجه
    const earAvg = (earLeft + earRight) / 2;
    const earMargin = eyesOpen
      ? Math.min(1, (earAvg - 0.21) / 0.12)
      : Math.max(0, 1 - (0.21 - earAvg) / 0.12);
    const sizeBonus = Math.min(1, areaRatio / 0.12);
    const confidence = Math.round(
      100 * (0.45 * best.detection.score + 0.4 * earMargin + 0.15 * sizeBonus)
    );

    console.log(
      `👁️ face: count=${results.length} area=${areaRatio.toFixed(3)} earL=${earLeft.toFixed(3)} earR=${earRight.toFixed(3)} open=${eyesOpen} conf=${confidence}`
    );
    return {
      engineOk: true,
      found: true,
      count: results.length,
      areaRatio,
      detectionScore: best.detection.score,
      earLeft,
      earRight,
      eyesOpen,
      confidence: Math.max(5, Math.min(98, confidence)),
    };
  } catch (e) {
    console.warn("[face] detection failed:", e);
    return { ...fail, engineOk: true };
  }
}

/**
 * بديل خفيف عند تعذر الشبكة العصبية: عدّادات داكنة في شريط العين
 * (يُستخدم مع FaceDetector الأصلي) - ثقة محدودة
 */
export function eyeBandHeuristic(
  gray: Float32Array | number[],
  W: number,
  H: number
): { candidates: number; likely: boolean } {
  const top = Math.floor(H * 0.25);
  const bottom = Math.floor(H * 0.6);
  const left = Math.floor(W * 0.2);
  const right = Math.floor(W * 0.8);
  let candidates = 0;
  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const i = y * W + x;
      const v = gray[i];
      if (v < 65) {
        const nb = [gray[i - 1] ?? 0, gray[i + 1] ?? 0, gray[i - W] ?? 0, gray[i + W] ?? 0];
        if (nb.filter((n) => n > v + 18).length >= 2) candidates++;
      }
    }
  }
  return { candidates, likely: candidates >= 8 };
}
