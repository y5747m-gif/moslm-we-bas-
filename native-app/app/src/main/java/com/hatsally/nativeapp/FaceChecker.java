package com.hatsally.nativeapp;

import android.graphics.Bitmap;
import android.graphics.Rect;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.face.Face;
import com.google.mlkit.vision.face.FaceDetection;
import com.google.mlkit.vision.face.FaceDetector;
import com.google.mlkit.vision.face.FaceDetectorOptions;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;

import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * كشف الوجه والعينين على الجهاز (ML Kit - بدون إنترنت) 👁️
 * يستخدم وضع ACCURATE للحصول على حالة العينين (مفتوحة/مغلقة).
 * يعمل على الأجهزة الضعيفة (نموذج محلي خفيف) والقوية على حد سواء.
 */
public class FaceChecker {

    public static class FaceInfo {
        public boolean ok;            // نجح التحليل
        public boolean mlkitAvailable = true;
        public int faceCount = 0;
        public int faceAreaPct = 0;   // نسبة أكبر وجه من مساحة الصورة
        public int leftEye = -1;      // 1 مفتوحة 0 مغلقة -1 مجهول
        public int rightEye = -1;
        public float leftOpenProb = 0f;
        public float rightOpenProb = 0f;
    }

    private FaceChecker() {}

    /**
     * تحليل الوجه في الخلفية (لا تستدعِ من UI thread).
     * @param bmp صورة مصغرة (يفضل ≤ 480px) - تُفلت بعد الاستخدام
     */
    public static FaceInfo analyze(final Bitmap bmp) {
        final FaceInfo info = new FaceInfo();
        FaceDetector detector = null;
        try {
            FaceDetectorOptions opts = new FaceDetectorOptions.Builder()
                    .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
                    .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
                    .setMinFaceSize(0.08f)
                    .build();
            detector = FaceDetection.getClient(opts);
            InputImage image = InputImage.fromBitmap(bmp, 0);
            Task<List<Face>> task = detector.process(image);
            List<Face> faces = Tasks.await(task, 10, TimeUnit.SECONDS);
            if (faces != null) {
                info.faceCount = faces.size();
                int frameArea = Math.max(1, bmp.getWidth() * bmp.getHeight());
                int biggest = 0;
                int leftEye = -1;
                int rightEye = -1;
                float lp = 0f;
                float rp = 0f;
                for (Face f : faces) {
                    Rect box = f.getBoundingBox();
                    int area = box != null ? Math.max(0, box.width()) * Math.max(0, box.height()) : 0;
                    if (area > biggest) {
                        biggest = area;
                        try {
                            int ls = f.getLeftEyeState();
                            int rs = f.getRightEyeState();
                            leftEye = ls == Face.EYE_STATE_UNKNOWN ? -1 : ls;
                            rightEye = rs == Face.EYE_STATE_UNKNOWN ? -1 : rs;
                            lp = f.getLeftEyeOpenProbability();
                            rp = f.getRightEyeOpenProbability();
                        } catch (Exception ignored) {}
                    }
                }
                info.faceAreaPct = biggest * 100 / frameArea;
                info.leftEye = leftEye;
                info.rightEye = rightEye;
                info.leftOpenProb = lp;
                info.rightOpenProb = rp;
            }
            info.ok = true;
        } catch (Exception e) {
            info.ok = false;
            info.mlkitAvailable = false;
        } finally {
            try {
                if (detector != null) detector.close();
            } catch (Exception ignored) {}
        }
        return info;
    }
}
