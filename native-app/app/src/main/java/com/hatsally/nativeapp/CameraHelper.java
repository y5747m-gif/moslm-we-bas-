package com.hatsally.nativeapp;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.ImageFormat;
import android.graphics.Matrix;
import android.graphics.SurfaceTexture;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.media.Image;
import android.media.ImageReader;
import android.os.Handler;
import android.os.HandlerThread;
import android.view.Surface;
import android.view.TextureView;

import java.util.Arrays;

/**
 * مساعد الكاميرا (Camera2) 📷
 * ---------------------------------------------------------------
 * - معاينة حية على TextureView (خفيفة على الأجهزة الضعيفة)
 * - التقاط إطار YUV وتحويله لـ Bitmap عند الطلب فقط
 * - كاميرا خلفية (الصنبور/المصلاة) أو أمامية (الوجه)
 * - إدارة كاملة للموارد (إغلاق سريع عند تبديل المهمة)
 */
public class CameraHelper {

    public interface Callback {
        void onOpened();

        void onError(String code); // "denied" | "missing" | "busy" | "unknown"
    }

    private static final int CAP_W = 960;
    private static final int CAP_H = 540;

    private final Context ctx;
    private final Callback callback;
    private TextureView textureView;
    private boolean facingFront;

    private CameraManager manager;
    private CameraDevice device;
    private CameraCaptureSession session;
    private ImageReader reader;
    private HandlerThread thread;
    private Handler handler;
    private volatile Image latestFrame;
    private boolean opened = false;
    private boolean previewing = false;
    private boolean useMirror;

    public CameraHelper(Context ctx, Callback cb) {
        this.ctx = ctx.getApplicationContext();
        this.callback = cb;
    }

    /** فتح الكاميرا: front=true للوجه */
    public void open(TextureView tv, boolean front) {
        close();
        this.textureView = tv;
        this.facingFront = front;
        this.useMirror = front;
        try {
            manager = (CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
            if (manager == null) {
                callback.onError("missing");
                return;
            }
            String camId = chooseCamera(front);
            if (camId == null) {
                callback.onError("missing");
                return;
            }
            thread = new HandlerThread("hatsally-cam");
            thread.start();
            handler = new Handler(thread.getLooper());
            reader = ImageReader.newInstance(CAP_W, CAP_H, ImageFormat.YUV_420_888, 2);

            if (!ctx.getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_CAMERA)) {
                callback.onError("missing");
                return;
            }

            if (android.os.Build.VERSION.SDK_INT >= 23) {
                if (ctx.checkSelfPermission(android.Manifest.permission.CAMERA)
                        != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    callback.onError("denied");
                    return;
                }
            }

            manager.openCamera(camId, new CameraDevice.StateCallback() {
                @Override
                public void onOpened(CameraDevice cam) {
                    device = cam;
                    startPreview();
                }

                @Override
                public void onDisconnected(CameraDevice cam) {
                    try {
                        cam.close();
                    } catch (Exception ignored) {}
                    device = null;
                    opened = false;
                }

                @Override
                public void onError(CameraDevice cam, int error) {
                    try {
                        cam.close();
                    } catch (Exception ignored) {}
                    device = null;
                    opened = false;
                    handler.post(new Runnable() {
                        @Override
                        public void run() {
                            callback.onError(error == 3 ? "busy" : "unknown");
                        }
                    });
                }
            }, handler);
        } catch (SecurityException e) {
            callback.onError("denied");
        } catch (Exception e) {
            callback.onError("unknown");
        }
    }

    public boolean isOpened() {
        return opened;
    }

    /** هل بدأت المعاينة الفعلية على السطح؟ */
    public boolean isPreviewing() {
        return previewing;
    }

    private String chooseCamera(boolean front) {
        try {
            String want = front
                    ? CameraCharacteristics.LENS_FACING_FRONT
                    : CameraCharacteristics.LENS_FACING_BACK;
            for (String id : manager.getCameraIds()) {
                CameraCharacteristics c = manager.getCameraCharacteristics(id);
                Integer f = c.get(CameraCharacteristics.LENS_FACING);
                if (f != null && f == Integer.parseInt(want + "")) return id;
                if (f != null && (f == CameraCharacteristics.LENS_FACING_FRONT ? front : !front)) return id;
            }
            return manager.getCameraIds()[0];
        } catch (Exception e) {
            return null;
        }
    }

    private void startPreview() {
        try {
            if (textureView == null || !textureView.isAvailable() || device == null) return;
            SurfaceTexture st = textureView.getSurfaceTexture();
            if (st == null) return;
            st.setDefaultBufferSize(CAP_W, CAP_H);
            Surface previewSurface = new Surface(st);

            CaptureRequest.Builder builder = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
            builder.addTarget(previewSurface);
            builder.addTarget(reader.getSurface());
            builder.set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO);

            reader.setOnImageAvailableListener(new ImageReader.OnImageAvailableListener() {
                @Override
                public void onImageAvailable(ImageReader r) {
                    Image img = null;
                    try {
                        img = r.acquireLatestImage();
                    } catch (Exception ignored) {}
                    if (img == null) return;
                    Image old = latestFrame;
                    latestFrame = img; // نحفظ الإطار فقط - التحويل عند الطلب
                    if (old != null) {
                        try {
                            old.close();
                        } catch (Exception ignored) {}
                    }
                }
            }, handler);

            device.createCaptureSession(Arrays.asList(previewSurface, reader.getSurface()),
                    new CameraCaptureSession.StateCallback() {
                        @Override
                        public void onConfigured(CameraCaptureSession s) {
                            session = s;
                            try {
                                builder.build();
                                s.setRepeatingRequest(builder.build(), null, handler);
                                opened = true;
                                previewing = true;
                                handler.post(new Runnable() {
                                    @Override
                                    public void run() {
                                        callback.onOpened();
                                    }
                                });
                            } catch (Exception e) {
                                handler.post(new Runnable() {
                                    @Override
                                    public void run() {
                                        callback.onError("unknown");
                                    }
                                });
                            }
                        }

                        @Override
                        public void onConfigureFailed(CameraCaptureSession s) {
                            handler.post(new Runnable() {
                                @Override
                                public void run() {
                                    callback.onError("unknown");
                                }
                            });
                        }
                    }, handler);
        } catch (Exception e) {
            handler.post(new Runnable() {
                @Override
                public void run() {
                    callback.onError("unknown");
                }
            });
        }
    }

    /** التقاط الصورة الحالية (يُستدعى من أي thread - يرجع null إن لم يكن جاهزاً) */
    public Bitmap capture() {
        Image img = latestFrame;
        if (img == null) return null;
        try {
            return yuvToBitmap(img);
        } catch (Exception e) {
            return null;
        }
    }

    /** تحويل إطار YUV_420_888 إلى Bitmap (مع مراعاة flip للكاميرا الأمامية) */
    private static Bitmap yuvToBitmap(Image img) {
        int w = img.getWidth();
        int h = img.getHeight();
        Image.Plane[] planes = img.getPlanes();
        android.util.ByteBuffer yB = planes[0].getBuffer();
        android.util.ByteBuffer uB = planes[1].getBuffer();
        android.util.ByteBuffer vB = planes[2].getBuffer();
        int yRowStride = planes[0].getRowStride();
        int uvRowStride = planes[1].getRowStride();
        int uvPixelStride = planes[1].getPixelStride();

        int[] pixels = new int[w * h];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int yp = y * yRowStride + x;
                int uvx = (x >> 1) * uvPixelStride + (y >> 1) * uvRowStride;
                int yv = yB.get(yp) & 0xFF;
                int uv = uB.get(uvx) & 0xFF;
                int vv = vB.get(uvx) & 0xFF;
                int r = (int) (yv + 1.402 * vv);
                int g = (int) (yv - 0.344136 * uv - 0.714136 * vv);
                int b = (int) (yv + 1.772 * uv);
                r = Math.max(0, Math.min(255, r));
                g = Math.max(0, Math.min(255, g));
                b = Math.max(0, Math.min(255, b));
                pixels[y * w + x] = 0xFF000000 | (r << 16) | (g << 8) | b;
            }
        }
        Bitmap bmp = Bitmap.createBitmap(pixels, w, h, Bitmap.Config.ARGB_8888);
        // تدوير حسب توجيه المستشعر
        try {
            int rotation = img.getImageInfo().getRotation();
            if (rotation != 0) {
                Matrix m = new Matrix();
                m.postRotate(rotation);
                Bitmap rotated = Bitmap.createBitmap(bmp, 0, 0, w, h, m, false);
                if (rotated != bmp) bmp.recycle();
                bmp = rotated;
            }
        } catch (Exception ignored) {}
        return bmp;
    }

    /** إغلاق كامل وموارد نظيفة */
    public void close() {
        opened = false;
        previewing = false;
        try {
            if (session != null) {
                session.close();
            }
        } catch (Exception ignored) {}
        session = null;
        try {
            if (device != null) {
                device.close();
            }
        } catch (Exception ignored) {}
        device = null;
        try {
            if (reader != null) {
                reader.close();
            }
        } catch (Exception ignored) {}
        reader = null;
        try {
            if (latestFrame != null) {
                latestFrame.close();
            }
        } catch (Exception ignored) {}
        latestFrame = null;
        if (thread != null) {
            try {
                thread.quitSafely();
            } catch (Exception ignored) {}
            thread = null;
        }
        handler = null;
    }
}
