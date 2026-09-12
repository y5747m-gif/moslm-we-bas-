package com.fajrwake.alarm

import android.Manifest
import android.app.TimePickerDialog
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.fajrwake.alarm.databinding.ActivityMainBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Main screen (Arabic, RTL):
 * - Enable/disable the Fajr alarm + pick its time.
 * - Request each permission explicitly with a clear explanation.
 * - "Test alarm" rings in 10 seconds so the user can try the 3-photo challenge.
 * - View / delete the locally stored proof photos.
 * - Disabling the alarm cancels everything immediately — the user is in control.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var store: AlarmStore

    private val cameraPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                toast(getString(R.string.msg_camera_granted))
            } else {
                toast(getString(R.string.msg_camera_denied))
                openAppDetails()
            }
            refreshPermissions()
        }

    private val notifPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (!granted) toast(getString(R.string.msg_notif_denied))
            refreshPermissions()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        store = AlarmStore(this)

        binding.tvTime.text = store.timeLabel()
        binding.switchEnable.isChecked = store.enabled

        binding.btnPickTime.setOnClickListener { showTimePicker() }

        binding.switchEnable.setOnCheckedChangeListener { _, checked ->
            setAlarmEnabled(checked)
        }

        binding.btnCamera.setOnClickListener {
            if (PermissionHelper.hasCamera(this)) {
                toast(getString(R.string.msg_already_granted))
            } else {
                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        }

        binding.btnNotif.setOnClickListener {
            if (PermissionHelper.hasNotifications(this)) {
                toast(getString(R.string.msg_already_granted))
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                notifPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        binding.btnExact.setOnClickListener {
            if (PermissionHelper.canScheduleExact(this)) {
                toast(getString(R.string.msg_already_granted))
            } else {
                try {
                    startActivity(PermissionHelper.exactAlarmSettingsIntent(this))
                } catch (_: Exception) {
                    openAppDetails()
                }
            }
        }

        binding.btnBattery.setOnClickListener {
            if (PermissionHelper.isBatteryExempt(this)) {
                toast(getString(R.string.msg_already_granted))
            } else {
                PermissionHelper.requestBatteryExemption(this)
            }
        }

        binding.btnTest.setOnClickListener {
            // Ring in 10 seconds so the user can safely try the challenge now.
            AlarmScheduler.scheduleOneShot(this, System.currentTimeMillis() + 10_000L)
            toast(getString(R.string.msg_test_scheduled))
        }

        binding.btnDeleteProofs.setOnClickListener {
            val n = PhotoCaptureManager.deleteAllProofs(this)
            toast(getString(R.string.msg_proofs_deleted, n))
            refreshProofs()
        }
    }

    override fun onResume() {
        super.onResume()
        refreshPermissions()
        refreshProofs()
        refreshStatus()
    }

    private fun showTimePicker() {
        TimePickerDialog(
            this,
            { _, h, m ->
                store.hour = h
                store.minute = m
                binding.tvTime.text = store.timeLabel()
                if (store.enabled) {
                    AlarmScheduler.scheduleDaily(this)
                    toast(getString(R.string.msg_alarm_updated, store.timeLabel()))
                }
                refreshStatus()
            },
            store.hour,
            store.minute,
            true
        ).show()
    }

    private fun setAlarmEnabled(checked: Boolean) {
        if (checked) {
            val missing = missingEssentials()
            if (missing.isNotEmpty()) {
                binding.switchEnable.isChecked = false
                toast(getString(R.string.msg_grant_first, missing.joinToString("، ")))
                return
            }
            store.enabled = true
            AlarmScheduler.scheduleDaily(this)
            toast(getString(R.string.msg_alarm_on, store.timeLabel()))
        } else {
            store.enabled = false
            AlarmScheduler.cancelAll(this)
            AlarmForegroundService.stop(this)
            toast(getString(R.string.msg_alarm_off))
        }
        refreshStatus()
    }

    /** Permissions required before the alarm can be trusted to ring. */
    private fun missingEssentials(): List<String> {
        val list = mutableListOf<String>()
        if (!PermissionHelper.hasCamera(this)) list.add(getString(R.string.perm_camera))
        if (!PermissionHelper.hasNotifications(this)) list.add(getString(R.string.perm_notif))
        return list
    }

    private fun refreshStatus() {
        if (store.enabled) {
            binding.tvStatusTitle.text = getString(R.string.status_on, store.timeLabel())
            binding.tvStatusDesc.text = getString(R.string.status_on_desc)
        } else {
            binding.tvStatusTitle.text = getString(R.string.status_off)
            binding.tvStatusDesc.text = getString(R.string.status_off_desc)
        }
    }

    private fun refreshPermissions() {
        setRow(binding.dotCamera, binding.btnCamera, PermissionHelper.hasCamera(this))
        setRow(binding.dotNotif, binding.btnNotif, PermissionHelper.hasNotifications(this))
        setRow(binding.dotExact, binding.btnExact, PermissionHelper.canScheduleExact(this))
        setRow(binding.dotBattery, binding.btnBattery, PermissionHelper.isBatteryExempt(this))
    }

    private fun setRow(dot: android.view.View, btn: android.widget.Button, granted: Boolean) {
        dot.setBackgroundResource(if (granted) R.drawable.dot_done else R.drawable.dot_pending)
        btn.text = getString(if (granted) R.string.state_granted else R.string.state_grant)
    }

    private fun refreshProofs() {
        val proofs = PhotoCaptureManager.listProofs(this)
        binding.tvProofCount.text = getString(R.string.proofs_count, proofs.size)
        binding.proofsRow.removeAllViews()
        val fmt = SimpleDateFormat("MM-dd HH:mm", Locale.US)
        for (file in proofs.take(6)) {
            val thumb = ImageView(this).apply {
                val size = (72 * resources.displayMetrics.density).toInt()
                layoutParams = LinearLayout.LayoutParams(size, size).apply {
                    marginEnd = (8 * resources.displayMetrics.density).toInt()
                }
                scaleType = ImageView.ScaleType.CENTER_CROP
                contentDescription = fmt.format(Date(file.lastModified()))
                clipToOutline = true
            }
            binding.proofsRow.addView(thumb)
            loadThumbnail(file.absolutePath, thumb)
        }
        (binding.proofsRow.layoutParams as? ViewGroup.LayoutParams) ?: Unit
        binding.tvProofHint.text = getString(R.string.proofs_hint)
    }

    private fun loadThumbnail(path: String, target: ImageView) {
        Thread {
            try {
                val opts = BitmapFactory.Options().apply { inSampleSize = 8 }
                val bmp = BitmapFactory.decodeFile(path, opts)
                runOnUiThread { if (bmp != null) target.setImageBitmap(bmp) }
            } catch (_: Exception) {
            }
        }.start()
    }

    private fun openAppDetails() {
        try {
            startActivity(PermissionHelper.appDetailsIntent(this))
        } catch (_: Exception) {
        }
    }

    private fun startActivitySafe(intent: Intent) {
        try {
            startActivity(intent)
        } catch (_: Exception) {
            toast(getString(R.string.msg_open_settings_failed))
        }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
}
