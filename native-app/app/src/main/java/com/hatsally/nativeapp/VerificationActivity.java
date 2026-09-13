package com.hatsally.nativeapp;

import android.Manifest;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.graphics.SurfaceTexture;
import android.os.Handler;
import android.os.Looper;
import android.view.TextureView;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

/**
 * شاشة التحقق بالتصوير 📷🤖
 * ---------------------------------------------------------------
 * ثلاث مهام لإثبات الاستيقاظ (بنفس روح نسخة الويب):
 * 1) صنبور المياه (الوضوء) - كاميرا خلفية
 * 2) المصلاة - كاميرا خلفية
 * 3) الوجه وعينان مفتوحتان - كاميرا أمامية (ML Kit)
 * - الصوت والنداء يستمران طوال التحقق
 * - لن يكتمل إلا بنجاح المهام الثلاث (أو تأكيد بعد محاولتين)
 */
public class VerificationActivity extends AppCompatActivity {

    private static final String[] TASKS = {"water", "prayer", "face"};

    private TextureView textureView;
    private View cameraPlaceholder;
    private ImageView capturedImg;
    private View capturedArea;
    private View analyzingOverlay;
    private ProgressBar analyzingBar;
    private View resultPanel;
    private TextView resultText;
    private TextView resultConf;
    private LinearLayout checksContainer;
    private LinearLayout tipsContainer;
    private TextView taskTitle;
    private TextView taskDesc;
    private TextView stepCounter;
    private TextView attemptsLabel;
    private View successView;
    private TextView successTitle;
    private TextView successDua;
    private View btnCapture;
    private View btnConfirm;
    private View btnRetake;
    private View btnClose;
    private View camOpenBtn;
    private TextView camErrorText;

    private CameraHelper cam;
    private SoundEngine sound;
    private SpeechEngine speech;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private int taskIndex = 0;
    private boolean[] done = {false, false, false};
    private int attempts = 0;
    private boolean demo = false;
    private Bitmap captured = null;
    private boolean analyzing = false;
    private String lang = "ar";
    private String name = "";
    private String pendingTaskId = "water";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.activity_verification);

        demo = getIntent() != null && getIntent().getBooleanExtra(AlarmActivity.EXTRA_DEMO, false);
        int alarmId = getIntent() != null ? getIntent().getIntExtra(AlarmActivity.EXTRA_ALARM_ID, 0) : 0;
        lang = AlarmPrefs.loadLang(this);
        boolean ar = "ar".equals(lang);
        name = AlarmPrefs.alarmName(this, alarmId);
        if (name == null || name.isEmpty()) name = ar ? "بطل الفجر" : "Fajr Hero";

        textureView = (TextureView) findViewById(R.id.cam_texture);
        cameraPlaceholder = findViewById(R.id.cam_placeholder);
        capturedImg = (ImageView) findViewById(R.id.captured_img);
        capturedArea = findViewById(R.id.captured_area);
        analyzingOverlay = findViewById(R.id.analyzing_overlay);
        analyzingBar = (ProgressBar) findViewById(R.id.analyzing_bar);
        resultPanel = findViewById(R.id.result_panel);
        resultText = (TextView) findViewById(R.id.result_text);
        resultConf = (TextView) findViewById(R.id.result_conf);
        checksContainer = (LinearLayout) findViewById(R.id.checks_container);
        tipsContainer = (LinearLayout) findViewById(R.id.tips_container);
        taskTitle = (TextView) findViewById(R.id.task_title);
        taskDesc = (TextView) findViewById(R.id.task_desc);
        stepCounter = (TextView) findViewById(R.id.step_counter);
        attemptsLabel = (TextView) findViewById(R.id.attempts_label);
        successView = findViewById(R.id.success_view);
        successTitle = (TextView) findViewById(R.id.success_title);
        successDua = (TextView) findViewById(R.id.success_dua);
        btnCapture = findViewById(R.id.btn_capture);
        btnConfirm = findViewById(R.id.btn_confirm);
        btnRetake = findViewById(R.id.btn_retake);
        btnClose = findViewById(R.id.btn_close);
        camOpenBtn = findViewById(R.id.cam_open_btn);
        camErrorText = (TextView) findViewById(R.id.cam_error_text);

        // لو جهّز النظام سطح المعاينة بعد فتح الكاميرا → نكمل بدء المعاينة
        textureView.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override
            public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
                if (cam != null && !cam.isPreviewing()) {
                    cam.open(textureView, "face".equals(pendingTaskId));
                }
            }

            @Override
            public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width, int height) {}

            @Override
            public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
                return true;
            }

            @Override
            public void onSurfaceTextureUpdated(SurfaceTexture surface) {}
        });

        sound = new SoundEngine(this);
        speech = new SpeechEngine(this);
        speech.setName(name);
        speech.setLang(lang);

        successTitle.setText(ar
                ? getString(R.string.success_title_ar, name)
                : getString(R.string.success_title_en, name));
        successDua.setText(getString(R.string.dua));

        btnCapture.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                onCapture();
            }
        });
        camOpenBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openCamera(pendingTaskId);
            }
        });
        btnConfirm.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                onConfirmManual();
            }
        });
        btnRetake.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                retake();
            }
        });
        btnClose.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finishAll();
            }
        });
    }

    @Override
    protected void onStart() {
        super.onStart();
        // الصوت مستمر طوال التحقق
        sound.maxVolume();
        sound.setStage(SoundEngine.STAGE_GENTLE);
        speech.startLoop("verify", TASKS[taskIndex]);
        if (captured == null && !successVisible()) {
            openCamera(TASKS[taskIndex]);
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (cam != null) cam.close();
        if (!demo) {
            // الرنين النظامي يستمر في الخلفية حتى العودة
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (cam != null) cam.close();
        sound.stopAll();
        speech.shutdown();
        if (captured != null) {
            captured.recycle();
            captured = null;
        }
    }

    private boolean successVisible() {
        return successView.getVisibility() == View.VISIBLE;
    }

    // ------------------------------------------------------------------
    // الكاميرا
    // ------------------------------------------------------------------
    private void openCamera(final String taskId) {
        pendingTaskId = taskId;
        attempts = 0;
        attemptsLabel.setText("");
        resultPanel.setVisibility(View.GONE);
        capturedArea.setVisibility(View.GONE);
        camErrorText.setText("");
        // البطاقة الوسيطة تبقى ظاهرة حتى تبدأ المعاينة فعلاً (زر إعادة المحاولة متاح دائماً)
        cameraPlaceholder.setVisibility(View.VISIBLE);
        btnCapture.setVisibility(View.GONE);

        if (Build.VERSION.SDK_INT >= 23 &&
                checkSelfPermission(Manifest.permission.CAMERA) != PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, 72);
            return;
        }

        if (cam == null) {
            cam = new CameraHelper(this, new CameraHelper.Callback() {
                @Override
                public void onOpened() {
                    if (isFinishing()) return;
                    cameraPlaceholder.setVisibility(View.GONE);
                    textureView.setVisibility(View.VISIBLE);
                    textureView.setAlpha(1f);
                    btnCapture.setVisibility(View.VISIBLE);
                }

                @Override
                public void onError(final String code) {
                    if (isFinishing()) return;
                    handler.post(new Runnable() {
                        @Override
                        public void run() {
                            cameraError(code);
                        }
                    });
                }
            });
        }
        cam.open(textureView, "face".equals(taskId));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 72) {
            if (grantResults.length > 0 && grantResults[0] == PERMISSION_GRANTED) {
                openCamera(pendingTaskId);
            } else {
                cameraError("denied");
            }
        }
    }

    private void cameraError(String code) {
        textureView.setVisibility(View.GONE);
        btnCapture.setVisibility(View.GONE);
        cameraPlaceholder.setVisibility(View.VISIBLE);
        camErrorText.setText(code.equals("denied") ? getString(R.string.cam_denied)
                : code.equals("missing") ? getString(R.string.cam_missing)
                : code.equals("busy") ? getString(R.string.cam_busy)
                : getString(R.string.cam_unknown));
    }

    // ------------------------------------------------------------------
    // التقاط وتحليل
    // ------------------------------------------------------------------
    private void onCapture() {
        if (cam == null || analyzing) return;
        Bitmap bmp = cam.capture();
        if (bmp == null) {
            Toast.makeText(this, getString(R.string.cam_notready), Toast.LENGTH_SHORT).show();
            return;
        }
        if (captured != null) captured.recycle();
        captured = bmp;
        capturedImg.setImageBitmap(bmp);
        capturedArea.setVisibility(View.VISIBLE);
        resultPanel.setVisibility(View.GONE);
        btnCapture.setVisibility(View.GONE);
        analyzingOverlay.setVisibility(View.VISIBLE);
        analyzingBar.setVisibility(View.VISIBLE);
        analyzing = true;

        final String taskId = TASKS[taskIndex];
        final Bitmap small = VisionCheck.downscale(bmp, 480);
        new Thread(new Runnable() {
            @Override
            public void run() {
                final FaceChecker.FaceInfo fi = FaceChecker.analyze(small);
                final VisionCheck.Result res;
                if (taskId.equals("water")) {
                    res = VisionCheck.checkWater(small, fi.faceCount, fi.faceAreaPct);
                } else if (taskId.equals("prayer")) {
                    res = VisionCheck.checkPrayer(small, fi.faceCount, fi.faceAreaPct);
                } else {
                    res = VisionCheck.checkFace(fi.faceCount, fi.faceAreaPct, fi.leftEye, fi.rightEye,
                            fi.leftOpenProb, fi.rightOpenProb, fi.mlkitAvailable);
                }
                if (small != bmp) small.recycle();
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        analyzing = false;
                        analyzingOverlay.setVisibility(View.GONE);
                        attempts++;
                        attemptsLabel.setText(getString(R.string.attempts, String.valueOf(attempts)));
                        showResult(taskId, res);
                    }
                });
            }
        }).start();
    }

    private void showResult(String taskId, VisionCheck.Result res) {
        resultPanel.setVisibility(View.VISIBLE);
        String msg = "";
        if (res.messageKey.equals("msgTapOk")) msg = getString(R.string.msgTapOk);
        else if (res.messageKey.equals("msgTapFail")) msg = getString(R.string.msgTapFail);
        else if (res.messageKey.equals("msgMatOk")) msg = getString(R.string.msgMatOk);
        else if (res.messageKey.equals("msgMatFail")) msg = getString(R.string.msgMatFail);
        else if (res.messageKey.equals("msgFaceOk")) msg = getString(R.string.msgFaceOk);
        else if (res.messageKey.equals("msgFaceNoFace")) msg = getString(R.string.msgFaceNoFace);
        else if (res.messageKey.equals("msgFaceSmall")) msg = getString(R.string.msgFaceSmall);
        else if (res.messageKey.equals("msgEyesClosed")) msg = getString(R.string.msgEyesClosed);
        resultText.setText((res.valid ? "✓ " : "✗ ") + msg);
        resultText.setTextColor(res.valid ? 0xFF34D399 : 0xFFF87171);
        resultConf.setText(getString(R.string.confidence, String.valueOf(res.confidence)));

        checksContainer.removeAllViews();
        for (String c : res.checks) {
            String[] p = c.split("\\|");
            TextView tv = new TextView(this);
            tv.setText((Integer.parseInt(p[1]) == 1 ? "✓ " : "✕ ") + getString(checkLabelRes(p[0])));
            tv.setTextColor(Integer.parseInt(p[1]) == 1 ? 0xFF34D399 : 0xFFF87171);
            tv.setTextSize(11);
            checksContainer.addView(tv);
        }
        tipsContainer.removeAllViews();
        for (String tip : res.tips) {
            TextView tv = new TextView(this);
            tv.setText("💡 " + getString(tipLabelRes(tip)));
            tv.setTextColor(0xFFFCD34D);
            tv.setTextSize(11);
            tipsContainer.addView(tv);
        }

        boolean canConfirm = res.confidence >= 30 || attempts >= 2;
        btnConfirm.setVisibility(canConfirm ? View.VISIBLE : View.GONE);
        btnConfirm.setText(canConfirm ? getString(R.string.confirm_anyway) : "");

        if (res.valid) {
            // نجاح: نداء تشجيعي ثم الخطوة التالية
            speech.speakNow(speech.verifyPhrase(taskId));
            final String tid = taskId;
            handler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    taskPassed(tid);
                }
            }, 1400);
        } else {
            speech.speakNow(speech.verifyPhrase(taskId));
        }
    }

    private int checkLabelRes(String id) {
        switch (id) {
            case "shine": return R.string.cl_shine;
            case "contrast": return R.string.cl_contrast;
            case "no_face": return R.string.cl_no_face;
            case "light": return R.string.cl_light;
            case "colors": return R.string.cl_colors;
            case "texture": return R.string.cl_texture;
            case "fill": return R.string.cl_fill;
            case "face_found": return R.string.cl_face_found;
            case "face_size": return R.string.cl_face_size;
            case "eyes_open": return R.string.cl_eyes_open;
            default: return R.string.cl_shine;
        }
    }

    private int tipLabelRes(String id) {
        switch (id) {
            case "tipLight": return R.string.tipLight;
            case "tipTapLight": return R.string.tipTapLight;
            case "tipTapCloser": return R.string.tipTapCloser;
            case "tipTapAngle": return R.string.tipTapAngle;
            case "tipTapOnly": return R.string.tipTapOnly;
            case "tipNotFace": return R.string.tipNotFace;
            case "tipMatColors": return R.string.tipMatColors;
            case "tipMatWhole": return R.string.tipMatWhole;
            case "tipMatCenter": return R.string.tipMatCenter;
            case "tipMatCloser": return R.string.tipMatCloser;
            case "tipFaceCloser": return R.string.tipFaceCloser;
            case "tipEyesOpen": return R.string.tipEyesOpen;
            default: return R.string.tipLight;
        }
    }

    private void taskPassed(String taskId) {
        for (int i = 0; i < TASKS.length; i++) {
            if (TASKS[i].equals(taskId)) {
                done[i] = true;
                taskIndex = i;
                break;
            }
        }
        if (captured != null) {
            captured.recycle();
            captured = null;
        }
        if (taskIndex + 1 < TASKS.length) {
            taskIndex++;
            updateTaskUI();
            capturedArea.setVisibility(View.GONE);
            resultPanel.setVisibility(View.GONE);
            openCamera(TASKS[taskIndex]);
        } else {
            showSuccess();
        }
    }

    private void onConfirmManual() {
        if (attempts < 2) return;
        taskPassed(pendingTaskId);
    }

    private void retake() {
        resultPanel.setVisibility(View.GONE);
        capturedArea.setVisibility(View.GONE);
        if (captured != null) {
            captured.recycle();
            captured = null;
        }
        openCamera(pendingTaskId);
    }

    // ------------------------------------------------------------------
    private void updateTaskUI() {
        String taskId = TASKS[taskIndex];
        boolean ar = "ar".equals(lang);
        stepCounter.setText((taskIndex + 1) + " / 3");
        if (taskId.equals("water")) {
            taskTitle.setText(ar ? getString(R.string.task_water_ar) : getString(R.string.task_water_en));
            taskDesc.setText(ar ? getString(R.string.task_water_desc_ar) : getString(R.string.task_water_desc_en));
        } else if (taskId.equals("prayer")) {
            taskTitle.setText(ar ? getString(R.string.task_prayer_ar) : getString(R.string.task_prayer_en));
            taskDesc.setText(ar ? getString(R.string.task_prayer_desc_ar) : getString(R.string.task_prayer_desc_en));
        } else {
            taskTitle.setText(ar ? getString(R.string.task_face_ar) : getString(R.string.task_face_en));
            taskDesc.setText(ar ? getString(R.string.task_face_desc_ar) : getString(R.string.task_face_desc_en));
        }
        updateDots();
    }

    private void updateDots() {
        int[] ids = {R.id.dot0, R.id.dot1, R.id.dot2};
        for (int i = 0; i < 3; i++) {
            View d = findViewById(ids[i]);
            if (done[i]) {
                d.setBackgroundColor(0xFF34D399);
            } else if (i == taskIndex) {
                d.setBackgroundColor(0xFFFFFFFF);
            } else {
                d.setBackgroundColor(0x33FFFFFF);
            }
        }
    }

    private void showSuccess() {
        successView.setVisibility(View.VISIBLE);
        capturedArea.setVisibility(View.GONE);
        cameraPlaceholder.setVisibility(View.GONE);
        if (cam != null) cam.close();
        sound.stopAll();
        speech.stopLoop();
        speech.speakNow(speech.successPhrase());
        // إيقاف رنين النظام - اكتمل التحقق
        if (!demo) {
            AlarmService.stop(this);
        }
    }

    private void finishAll() {
        if (!demo) {
            Intent i = new Intent(this, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(i);
        }
        finish();
    }

    /** منع الرجوع أثناء التحقق */
    @Override
    public void onBackPressed() {
        if (demo) {
            super.onBackPressed();
            return;
        }
        Toast.makeText(this, getString(R.string.cannot_close), Toast.LENGTH_SHORT).show();
    }
}
