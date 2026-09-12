package com.fajrwake.alarm

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.CountDownTimer
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.WindowManager
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.fajrwake.alarm.databinding.ActivityAlarmBinding
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Full-screen ringing screen with the 3-photo wake-up challenge.
 *
 * Behavior contract (agreed with the user at install time):
 * - Shows over the lock screen with sound + vibration until dismissed properly.
 * - Back button / gestures do NOT dismiss it — a toast explains the legit exits.
 * - Legit exits ALWAYS available:
 *   1) Complete the 3 photos (the challenge itself),
 *   2) "Snooze 5 min" button (honest, announced),
 *   3) Emergency stop by holding its button for 5 seconds,
 *   4) Automatic stop after 15 minutes (failsafe in the service + here),
 *   5) Uninstalling / force-stopping from system settings always works.
 */
class AlarmActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAlarmBinding
    private lateinit var store: AlarmStore
    private lateinit var captureManager: PhotoCaptureManager

    private var captured = 0
    private var required = 3
    private var cameraReady = false
    private var finished = false

    private var clockTimer: CountDownTimer? = null
    private var failsafeTimer: CountDownTimer? = null

    private val handler = Handler(Looper.getMainLooper())
    private var emergencyCountdown: CountDownTimer? = null
    private val emergencyFire = Runnable { emergencyStop() }

    private val stoppedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            // Service stopped elsewhere (snooze from notification, disable, failsafe).
            finishQuietly()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Appear over the lock screen, turn it on, keep it on while ringing.
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        binding = ActivityAlarmBinding.inflate(layoutInflater)
        setContentView(binding.root)

        store = AlarmStore(this)
        required = store.photosRequired
        captureManager = PhotoCaptureManager(this)

        // Back press never dismisses the challenge — but always explains the exits.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                toast(getString(R.string.msg_back_blocked))
            }
        })

        binding.btnCapture.setOnClickListener { captureOne() }
        binding.btnSwitchCamera.setOnClickListener { switchCamera() }
        binding.btnSnooze.setOnClickListener { snooze() }
        setupEmergencyHold()

        updateProgress()
        startClock()
        startFailsafe()
        registerStoppedReceiver()
        initCamera()
    }

    override fun onDestroy() {
        clockTimer?.cancel()
        failsafeTimer?.cancel()
        emergencyCountdown?.cancel()
        handler.removeCallbacks(emergencyFire)
        try {
            unregisterReceiver(stoppedReceiver)
        } catch (_: Exception) {
        }
        try {
            captureManager.unbind()
        } catch (_: Exception) {
        }
        super.onDestroy()
    }

    // ---------- Camera ----------

    private fun hasCameraPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED

    private fun initCamera() {
        if (!hasCameraPermission()) {
            showError(getString(R.string.err_no_camera_permission))
            binding.btnCapture.isEnabled = false
            return
        }
        binding.btnCapture.isEnabled = false
        captureManager.bind(this, binding.previewView) { ok ->
            cameraReady = ok
            runOnUiThread {
                if (ok) {
                    hideError()
                    binding.btnCapture.isEnabled = true
                } else {
                    showError(getString(R.string.err_camera_open))
                }
            }
        }
    }

    private fun switchCamera() {
        if (!cameraReady) {
            initCamera()
            return
        }
        binding.btnCapture.isEnabled = false
        captureManager.toggleCamera(this, binding.previewView) { ok ->
            runOnUiThread {
                cameraReady = ok
                binding.btnCapture.isEnabled = ok
                if (!ok) showError(getString(R.string.err_camera_open)) else hideError()
            }
        }
    }

    private fun captureOne() {
        if (finished || !cameraReady) return
        binding.btnCapture.isEnabled = false
        hideError()
        captureManager.takePhoto(object : PhotoCaptureManager.CaptureCallback {
            override fun onSuccess(file: File) {
                runOnUiThread { onPhotoSaved(file) }
            }

            override fun onError(message: String) {
                runOnUiThread {
                    binding.btnCapture.isEnabled = true
                    showError(message)
                }
            }
        })
    }

    private fun onPhotoSaved(file: File) {
        captured++
        updateProgress()
        if (captured >= required) {
            finishChallenge()
        } else {
            binding.btnCapture.isEnabled = true
            toast(getString(R.string.msg_photo_saved, captured, required))
        }
    }

    // ---------- Exits ----------

    /** The challenge is complete — stop everything with a blessing. */
    private fun finishChallenge() {
        if (finished) return
        finished = true
        AlarmForegroundService.stop(this)
        toast(getString(R.string.msg_challenge_done))
        finish()
    }

    private fun snooze() {
        if (finished) return
        finished = true
        val minutes = store.snoozeMinutes
        AlarmForegroundService.stop(this)
        AlarmScheduler.scheduleSnooze(this, minutes)
        toast(getString(R.string.msg_snoozed, minutes))
        finish()
    }

    /** Emergency exit: only fires after a deliberate 5-second hold. */
    private fun emergencyStop() {
        if (finished) return
        finished = true
        emergencyCountdown?.cancel()
        AlarmForegroundService.stop(this)
        toast(getString(R.string.msg_emergency_stopped))
        finish()
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupEmergencyHold() {
        binding.btnEmergency.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    startEmergencyCountdown()
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    cancelEmergencyHold()
                    true
                }
                else -> false
            }
        }
    }

    private fun startEmergencyCountdown() {
        emergencyCountdown?.cancel()
        handler.removeCallbacks(emergencyFire)
        emergencyCountdown = object : CountDownTimer(EMERGENCY_HOLD_MS, 500L) {
            override fun onTick(millisLeft: Long) {
                val secs = ((millisLeft + 999) / 1000).toInt()
                binding.tvEmergencyHint.text = getString(R.string.emergency_countdown, secs)
            }

            override fun onFinish() {
                binding.tvEmergencyHint.text = getString(R.string.emergency_hint)
            }
        }.start()
        handler.postDelayed(emergencyFire, EMERGENCY_HOLD_MS)
        toast(getString(R.string.msg_emergency_hold))
    }

    private fun cancelEmergencyHold() {
        emergencyCountdown?.cancel()
        handler.removeCallbacks(emergencyFire)
        binding.tvEmergencyHint.text = getString(R.string.emergency_hint)
    }

    private fun finishQuietly() {
        if (finished) return
        finished = true
        try {
            finish()
        } catch (_: Exception) {
        }
    }

    // ---------- UI helpers ----------

    private fun updateProgress() {
        binding.tvProgress.text = getString(R.string.progress_text, captured, required)
        styleDot(binding.dot1, captured >= 1, "1")
        styleDot(binding.dot2, captured >= 2, "2")
        styleDot(binding.dot3, captured >= 3, "3")
    }

    private fun styleDot(dot: TextView, done: Boolean, label: String) {
        dot.text = if (done) "✓" else label
        dot.setBackgroundResource(if (done) R.drawable.dot_done else R.drawable.dot_pending)
    }

    private fun showError(msg: String) {
        binding.tvError.text = msg
        binding.tvError.visibility = android.view.View.VISIBLE
    }

    private fun hideError() {
        binding.tvError.visibility = android.view.View.GONE
    }

    private fun startClock() {
        clockTimer?.cancel()
        val fmt = SimpleDateFormat("HH:mm", Locale.US)
        binding.tvClock.text = fmt.format(Date())
        clockTimer = object : CountDownTimer(Long.MAX_VALUE, 1000L) {
            override fun onTick(millisUntilFinished: Long) {
                binding.tvClock.text = fmt.format(Date())
            }

            override fun onFinish() {}
        }.start()
    }

    /** Second layer of the 15-minute failsafe (the service has the first). */
    private fun startFailsafe() {
        failsafeTimer?.cancel()
        failsafeTimer = object : CountDownTimer(FAILSAFE_MILLIS, FAILSAFE_MILLIS) {
            override fun onTick(millisUntilFinished: Long) {}
            override fun onFinish() {
                if (!finished) {
                    finished = true
                    AlarmForegroundService.stop(this@AlarmActivity)
                    finish()
                }
            }
        }.start()
    }

    private fun registerStoppedReceiver() {
        try {
            val filter = IntentFilter(AlarmForegroundService.ACTION_ALARM_STOPPED)
            ContextCompat.registerReceiver(
                this, stoppedReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED
            )
        } catch (_: Exception) {
        }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    companion object {
        private const val EMERGENCY_HOLD_MS = 5000L
        private const val FAILSAFE_MILLIS = 15 * 60 * 1000L
    }
}
