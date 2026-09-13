package com.hatsally.nativeapp;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;

import java.util.ArrayList;
import java.util.List;

/**
 * فحص الصور بالذكاء (على الجهاز - بدون إنترنت) 🤖
 * ---------------------------------------------------------------
 * - صنبور المياه: لمعان معدني + تباين عالٍ + لا يوجد وجه
 * - المصلاة: ثراء ألوان + نقوش/نسيج + تغطية كبيرة + لا وجه
 * - الوجه: كشف Face + عينان مفتوحتان + قرب مناسب
 * النتيجة: ثقة 0-100 + فحوصات معروضة + نصائح (نفس روح الويب)
 */
public final class VisionCheck {

    public static class Result {
        public boolean valid;
        public int confidence;
        public String messageKey; // cl_* مفاتيح عرض الفحوصات
        public List<String> checks = new ArrayList<String>(); // "id|1/0"
        public List<String> tips = new ArrayList<String>();

        public Result(boolean valid, int confidence, String messageKey) {
            this.valid = valid;
            this.confidence = confidence;
            this.messageKey = messageKey;
        }
    }

    private VisionCheck() {}

    /** تصغير الصورة للفحص السريع (الأجهزة الضعيفة) */
    public static Bitmap downscale(Bitmap src, int maxDim) {
        int w = src.getWidth();
        int h = src.getHeight();
        float scale = Math.min(1f, maxDim / (float) Math.max(w, h));
        if (scale >= 1f) return src;
        Matrix m = new Matrix();
        m.postScale(scale, scale);
        try {
            return Bitmap.createBitmap(src, 0, 0, w, h, m, false);
        } catch (Exception e) {
            return src;
        }
    }

    // ------------------------------------------------------------------
    // إحصاءات البكسل
    // ------------------------------------------------------------------
    private static int meanLuma(Bitmap b) {
        int n = b.getWidth() * b.getHeight();
        long sum = 0;
        for (int y = 0; y < b.getHeight(); y++) {
            for (int x = 0; x < b.getWidth(); x++) {
                int p = b.getPixel(x, y);
                sum += (0.299 * ((p >> 16) & 255) + 0.587 * ((p >> 8) & 255) + 0.114 * (p & 255));
            }
        }
        return n == 0 ? 0 : (int) (sum / n);
    }

    private static int stdLuma(Bitmap b) {
        int n = b.getWidth() * b.getHeight();
        if (n == 0) return 0;
        double mean = 0;
        for (int y = 0; y < b.getHeight(); y++) {
            for (int x = 0; x < b.getWidth(); x++) {
                int p = b.getPixel(x, y);
                mean += (0.299 * ((p >> 16) & 255) + 0.587 * ((p >> 8) & 255) + 0.114 * (p & 255));
            }
        }
        mean /= n;
        double var = 0;
        for (int y = 0; y < b.getHeight(); y++) {
            for (int x = 0; x < b.getWidth(); x++) {
                int p = b.getPixel(x, y);
                double l = 0.299 * ((p >> 16) & 255) + 0.587 * ((p >> 8) & 255) + 0.114 * (p & 255);
                var += (l - mean) * (l - mean);
            }
        }
        return (int) Math.sqrt(var / n);
    }

    /** نسبة البكسلات فائقة اللمعان (لمعان معدني) */
    private static double brightFraction(Bitmap b, int threshold) {
        int total = 0;
        int bright = 0;
        for (int y = 0; y < b.getHeight(); y++) {
            for (int x = 0; x < b.getWidth(); x++) {
                int p = b.getPixel(x, y);
                double l = 0.299 * ((p >> 16) & 255) + 0.587 * ((p >> 8) & 255) + 0.114 * (p & 255);
                total++;
                if (l > threshold) bright++;
            }
        }
        return total == 0 ? 0 : (double) bright / total;
    }

    /** متوسط التشبع (ثراء الألوان) */
    private static int meanSaturation(Bitmap b) {
        int total = 0;
        int count = 0;
        for (int y = 0; y < b.getHeight(); y += 2) {
            for (int x = 0; x < b.getWidth(); x += 2) {
                int p = b.getPixel(x, y);
                int r = (p >> 16) & 255;
                int g = (p >> 8) & 255;
                int bl = p & 255;
                int max = Math.max(r, Math.max(g, bl));
                int min = Math.min(r, Math.min(g, bl));
                total += max - min;
                count++;
            }
        }
        return count == 0 ? 0 : total / count;
    }

    /** كثافة الحواف (نسيج/نقوش) */
    private static double edgeDensity(Bitmap b, int threshold) {
        int w = b.getWidth();
        int h = b.getHeight();
        if (w < 2 || h < 2) return 0;
        int edges = 0;
        int samples = 0;
        for (int y = 1; y < h; y += 2) {
            for (int x = 1; x < w; x += 2) {
                int p1 = b.getPixel(x, y);
                int p2 = b.getPixel(x - 1, y);
                int d = Math.abs((p1 & 255) - (p2 & 255)) + Math.abs(((p1 >> 8) & 255) - ((p2 >> 8) & 255));
                samples++;
                if (d > threshold) edges++;
            }
        }
        return samples == 0 ? 0 : (double) edges / samples;
    }

    /** تغطية منطقة مركزية بنسبة لون غير محايد (المصلاء تملأ الصورة) */
    private static double centralColorCoverage(Bitmap b) {
        int w = b.getWidth();
        int h = b.getHeight();
        int cover = 0;
        int total = 0;
        for (int y = h / 6; y < h * 5 / 6; y += 2) {
            for (int x = w / 6; x < w * 5 / 6; x += 2) {
                int p = b.getPixel(x, y);
                int r = (p >> 16) & 255;
                int g = (p >> 8) & 255;
                int bl = p & 255;
                int max = Math.max(r, Math.max(g, bl));
                int min = Math.min(r, Math.min(g, bl));
                total++;
                if (max - min > 28) cover++; // لون واضح (سجادة) وليس رمادي معدني
            }
        }
        return total == 0 ? 0 : (double) cover / total;
    }

    // ------------------------------------------------------------------
    // فحوصات المهام الثلاث (تُستدعى بخلفية ML Kit جاهزة)
    // ------------------------------------------------------------------

    /** صنبور المياه: لمعان + تباين + بدون وجه */
    public static Result checkWater(Bitmap src, int faceCount, int faceAreaPct) {
        Bitmap b = downscale(src, 160);
        Result r = new Result(false, 0, "msgTapFail");
        int std = stdLuma(b);
        double bright = brightFraction(b, 230);
        int mean = meanLuma(b);

        boolean cSpecular = bright > 0.0008 && bright < 0.10; // لمعان معدني محدود
        boolean cContrast = std > 42;
        boolean cNoFace = faceCount == 0 || faceAreaPct < 12;
        boolean cNotDark = mean > 55;

        addCheck(r, "shine", cSpecular);
        addCheck(r, "contrast", cContrast);
        addCheck(r, "no_face", cNoFace);
        addCheck(r, "light", cNotDark);

        int score = 0;
        if (cSpecular) score += 45;
        if (cContrast) score += 25;
        if (cNoFace) score += 20;
        if (cNotDark) score += 10;

        // بدون لمعان واضح: نسمح بمرور "أبيض-رمادي باهت" (صنبور مطلي)
        if (!cSpecular && mean > 150 && std > 60 && cNoFace) score = Math.max(score, 55);

        r.confidence = clamp(score);
        r.valid = r.confidence >= 55;
        if (r.valid) r.messageKey = "msgTapOk";
        if (faceCount > 0 && faceAreaPct >= 12) r.tips.add("tipNotFace");
        if (!cNotDark) r.tips.add("tipTapLight");
        if (!cSpecular && !cContrast) r.tips.add("tipTapCloser");
        if (cNoFace && cNotDark) {
            r.tips.add("tipTapAngle");
            r.tips.add("tipTapOnly");
        }
        return r;
    }

    /** المصلاة: ألوان + نسيج + تغطية + بدون وجه */
    public static Result checkPrayer(Bitmap src, int faceCount, int faceAreaPct) {
        Bitmap b = downscale(src, 160);
        Result r = new Result(false, 0, "msgMatFail");
        int sat = meanSaturation(b);
        double edges = edgeDensity(b, 34);
        double cover = centralColorCoverage(b);
        int mean = meanLuma(b);
        boolean cColor = sat > 38;
        boolean cTexture = edges > 0.03 && edges < 0.65;
        boolean cCover = cover > 0.35;
        boolean cNoFace = faceCount == 0 || faceAreaPct < 12;
        boolean cNotDark = mean > 45;

        addCheck(r, "colors", cColor);
        addCheck(r, "texture", cTexture);
        addCheck(r, "fill", cCover);
        addCheck(r, "no_face", cNoFace);

        int score = 0;
        if (cColor) score += 35;
        if (cTexture) score += 25;
        if (cCover) score += 25;
        if (cNoFace) score += 10;
        if (cNotDark) score += 5;

        r.confidence = clamp(score);
        r.valid = r.confidence >= 55;
        if (r.valid) r.messageKey = "msgMatOk";
        if (faceCount > 0 && faceAreaPct >= 12) r.tips.add("tipNotFace");
        if (!cColor) r.tips.add("tipMatColors");
        if (!cCover) r.tips.add("tipMatWhole");
        if (!cTexture) r.tips.add("tipMatCenter");
        if (cColor && cCover) r.tips.add("tipMatCloser");
        return r;
    }

    /** الوجه: Face موجود + عينان مفتوحتان + قرب مناسب */
    public static Result checkFace(int faceCount, int faceAreaPct, int leftEye, int rightEye,
                                   float leftOpenProb, float rightOpenProb, boolean mlkitOk) {
        Result r = new Result(false, 0, "msgFaceNoFace");
        boolean cFound = faceCount == 1;
        boolean cSize = faceAreaPct >= 8 && faceAreaPct <= 95;

        // حالة العين: 1=مفتوحة 0=مغلقة -1=غير معروف
        boolean eyesKnown = mlkitOk && (leftEye != -1 || rightEye != -1);
        boolean cEyes;
        if (!mlkitOk) {
            // بديل تقريبي بدون ML Kit: وجود وجه واحد كافٍ
            cEyes = cFound;
        } else if (eyesKnown) {
            boolean lOk = leftEye != 0;
            boolean rOk = rightEye != 0;
            cEyes = lOk && rOk;
        } else {
            cEyes = (leftOpenProb > 0.3f) || (rightOpenProb > 0.3f);
        }

        addCheck(r, "face_found", cFound);
        addCheck(r, "face_size", cSize);
        addCheck(r, "eyes_open", cEyes);

        int score = 0;
        if (cFound) score += 55;
        if (cSize) score += 25;
        if (cEyes) score += 20;
        else if (mlkitOk && eyesKnown) score += 0;

        r.confidence = clamp(score);
        r.valid = r.confidence >= 55 && cFound;
        if (!cFound) {
            r.messageKey = "msgFaceNoFace";
            r.tips.add("tipFaceCloser");
        } else if (!cEyes) {
            r.messageKey = "msgEyesClosed";
            r.tips.add("tipEyesOpen");
        } else if (!cSize) {
            r.messageKey = "msgFaceSmall";
            r.tips.add("tipFaceCloser");
        } else {
            r.messageKey = "msgFaceOk";
        }
        return r;
    }

    private static void addCheck(Result r, String id, boolean passed) {
        r.checks.add(id + (passed ? "|1" : "|0"));
    }

    private static int clamp(int v) {
        return Math.max(0, Math.min(100, v));
    }

    /** إعادة بناء Bitmap من مصفوفة bytes (لإعادة الاستخدام) */
    @SuppressWarnings("unused")
    public static Bitmap fromBytes(byte[] data) {
        return BitmapFactory.decodeByteArray(data, 0, data.length);
    }
}
