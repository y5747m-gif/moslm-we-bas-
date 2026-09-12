package com.fajrwake.alarm

import android.content.Context
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executor

/**
 * Robust on-device photo capture built on CameraX.
 *
 * Strength features:
 * - Front camera by default (selfie proof), with one-tap fallback to back camera.
 * - CAPTURE_MODE_MINIMIZE_LATENCY for fast shots on weak devices.
 * - Automatic retry (up to MAX_ATTEMPTS) with a short delay between attempts.
 * - Verifies every file exists and is non-empty before counting it.
 * - Photos are stored in app-private storage only: files/wake_proofs/
 */
class PhotoCaptureManager(private val context: Context) {

    interface CaptureCallback {
        fun onSuccess(file: File)
        fun onError(message: String)
    }

    private var imageCapture: ImageCapture? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private var lensFacing: Int = CameraSelector.LENS_FACING_FRONT
    private val executor: Executor by lazy { ContextCompat.getMainExecutor(context) }

    val isFront: Boolean get() = lensFacing == CameraSelector.LENS_FACING_FRONT

    /** Bind preview + capture use-cases. Calls [onReady] with true/false. */
    fun bind(
        lifecycleOwner: LifecycleOwner,
        previewView: PreviewView,
        onReady: (Boolean) -> Unit
    ) {
        val future = ProcessCameraProvider.getInstance(context)
        future.addListener({
            try {
                val provider = future.get()
                cameraProvider = provider
                bindInternal(lifecycleOwner, previewView, provider)
                onReady(true)
            } catch (e: Exception) {
                Log.e(TAG, "Camera init failed", e)
                onReady(false)
            }
        }, executor)
    }

    /** Switch between front/back camera and re-bind. */
    fun toggleCamera(
        lifecycleOwner: LifecycleOwner,
        previewView: PreviewView,
        onReady: (Boolean) -> Unit
    ) {
        lensFacing = if (lensFacing == CameraSelector.LENS_FACING_FRONT) {
            CameraSelector.LENS_FACING_BACK
        } else {
            CameraSelector.LENS_FACING_FRONT
        }
        val provider = cameraProvider
        if (provider == null) {
            bind(lifecycleOwner, previewView, onReady)
            return
        }
        try {
            bindInternal(lifecycleOwner, previewView, provider)
            onReady(true)
        } catch (e: Exception) {
            Log.e(TAG, "Camera toggle failed", e)
            // Revert to the previous lens and try once more.
            lensFacing = if (lensFacing == CameraSelector.LENS_FACING_FRONT) {
                CameraSelector.LENS_FACING_BACK
            } else {
                CameraSelector.LENS_FACING_FRONT
            }
            try {
                bindInternal(lifecycleOwner, previewView, provider)
                onReady(true)
            } catch (e2: Exception) {
                onReady(false)
            }
        }
    }

    private fun bindInternal(
        lifecycleOwner: LifecycleOwner,
        previewView: PreviewView,
        provider: ProcessCameraProvider
    ) {
        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }
        imageCapture = ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .setFlashMode(ImageCapture.FLASH_MODE_OFF)
            .build()
        val selector = CameraSelector.Builder()
            .requireLensFacing(lensFacing)
            .build()
        provider.unbindAll()
        provider.bindToLifecycle(lifecycleOwner, selector, preview, imageCapture)
    }

    fun unbind() {
        try {
            cameraProvider?.unbindAll()
        } catch (_: Exception) {
        }
    }

    /** Take one photo with automatic retries. Result delivered on the main thread. */
    fun takePhoto(callback: CaptureCallback, attempt: Int = 1) {
        val capture = imageCapture
        if (capture == null) {
            callback.onError(context.getString(R.string.err_camera_not_ready))
            return
        }
        val file = newOutputFile()
        val options = ImageCapture.OutputFileOptions.Builder(file).build()
        capture.takePicture(
            options,
            executor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    if (file.exists() && file.length() > 0) {
                        callback.onSuccess(file)
                    } else {
                        retryOrFail(callback, attempt, "empty file")
                    }
                }

                override fun onError(exception: ImageCaptureException) {
                    Log.w(TAG, "Capture attempt $attempt failed", exception)
                    try {
                        file.delete()
                    } catch (_: Exception) {
                    }
                    retryOrFail(callback, attempt, exception.message ?: "capture failed")
                }
            }
        )
    }

    private fun retryOrFail(callback: CaptureCallback, attempt: Int, reason: String) {
        if (attempt < MAX_ATTEMPTS) {
            executor.execute {
                try {
                    Thread.sleep(RETRY_DELAY_MS)
                } catch (_: Exception) {
                }
                takePhoto(callback, attempt + 1)
            }
            // Note: sleep happens on main executor briefly; delay is tiny (400ms).
        } else {
            callback.onError(
                context.getString(R.string.err_capture_failed_after_retry, MAX_ATTEMPTS)
            )
        }
    }

    private fun newOutputFile(): File {
        val dir = File(context.filesDir, PROOFS_DIR).apply { mkdirs() }
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.US).format(Date())
        return File(dir, "IMG_$stamp.jpg")
    }

    companion object {
        private const val TAG = "PhotoCapture"
        private const val PROOFS_DIR = "wake_proofs"
        private const val MAX_ATTEMPTS = 3
        private const val RETRY_DELAY_MS = 400L

        /** All saved proof photos, newest first. */
        fun listProofs(context: Context): List<File> {
            val dir = File(context.filesDir, PROOFS_DIR)
            if (!dir.exists()) return emptyList()
            return dir.listFiles { f -> f.isFile && f.length() > 0 }
                ?.sortedByDescending { it.lastModified() }
                ?: emptyList()
        }

        /** Delete every proof photo. Returns number of deleted files. */
        fun deleteAllProofs(context: Context): Int {
            var count = 0
            for (f in listProofs(context)) {
                try {
                    if (f.delete()) count++
                } catch (_: Exception) {
                }
            }
            return count
        }
    }
}
