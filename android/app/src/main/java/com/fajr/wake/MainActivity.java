package com.fajr.wake;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.AlertDialog;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Calendar;

/** الشاشة الرئيسية: تفعيل المنبه، الصلاحيات (بموافقة المستخدم)، والإعدادات */
public class MainActivity extends Activity {

    private static final int REQ_NOTIF = 1;
    private static final int REQ_LOCATION = 2;
    private static final int REQ_SOUND_PICK = 42;

    private static final int[] MINUTES_OPTIONS = {0, 5, 10, 15, 20, 30};

    private TextView statusPill, nextValue, countdownValue, cityValue, methodValue,
            minutesValue, soundValue, backupToggle, statValue;
    private Button btnToggle;
    private LinearLayout permsBox;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private LocationListener gpsListener;
    private AlertDialog soundDialog;
    private RadioButton rbDefault, rbPick, rbNone;
    private Uri pendingPickUri;

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            updateCountdown();
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refresh();
        handler.post(ticker);
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(ticker);
    }

    // ================== بناء الواجهة ==================

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(getColor(R.color.bg));
        scroll.setFillViewport(true);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = px(20);
        root.setPadding(pad, px(28), pad, px(32));

        // الترويسة
        root.addView(label("🕌 إيقاظ الفجر", 26, getColor(R.color.accent), true, 2));
        root.addView(label("منبّه يومي يوقظك لصلاة الفجر — وأنت من يمنح كل إذن", 14,
                getColor(R.color.text_dim), false, 14));

        // بطاقة الفجر القادم
        LinearLayout nextCard = card();
        statusPill = pillLabel("", 12);
        statusPill.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams pillLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        pillLp.gravity = Gravity.CENTER_HORIZONTAL;
        pillLp.bottomMargin = px(10);
        statusPill.setLayoutParams(pillLp);
        nextCard.addView(statusPill);

        nextCard.addView(label("الفجر القادم", 13, getColor(R.color.text_dim), false, 2));
        nextValue = label(getString(R.string.no_alarm_today), 38, getColor(R.color.accent), true, 4);
        nextValue.setGravity(Gravity.CENTER);
        nextCard.addView(nextValue);
        countdownValue = label("", 14, getColor(R.color.text_main), false, 0);
        countdownValue.setGravity(Gravity.CENTER);
        nextCard.addView(countdownValue);
        root.addView(nextCard);

        root.addView(spacer(14));

        // زر التفعيل الرئيسي
        btnToggle = new Button(this);
        btnToggle.setAllCaps(false);
        btnToggle.setTextSize(17);
        btnToggle.setTypeface(Typeface.DEFAULT_BOLD);
        btnToggle.setTextColor(getColor(R.color.bg));
        btnToggle.setStateListAnimator(null);
        btnToggle.setBackground(null);
        btnToggle.setOnClickListener(v -> onToggle());
        root.addView(btnToggle, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, px(58)));

        root.addView(spacer(16));

        // بطاقة الإعدادات
        LinearLayout settings = card();
        settings.addView(sectionTitle(getString(R.string.sec_settings)));
        settings.addView(settingRow(getString(R.string.row_city), null));
        cityValue = rowValue(settings, () -> pickCity());

        settings.addView(settingRow(getString(R.string.row_method), null));
        methodValue = rowValue(settings, () -> pickMethod());

        settings.addView(settingRow(getString(R.string.row_minutes), null));
        minutesValue = rowValue(settings, () -> pickMinutes());

        settings.addView(settingRow(getString(R.string.row_sound), null));
        soundValue = rowValue(settings, () -> pickSound());

        // صف المنبه الاحتياطي (تبديل مباشر)
        LinearLayout backupRow = new LinearLayout(this);
        backupRow.setOrientation(LinearLayout.HORIZONTAL);
        backupRow.setGravity(Gravity.CENTER_VERTICAL);
        backupRow.setPadding(0, px(12), 0, px(12));
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        backupRow.setLayoutParams(blp);
        TextView bTitle = label("", 15, getColor(R.color.text_main), false, 0);
        bTitle.setText(R.string.row_backup);
        bTitle.setLayoutParams(new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        backupRow.addView(bTitle);
        backupToggle = pillLabel("", 13);
        backupToggle.setOnClickListener(v -> {
            Prefs p = Prefs.get(this);
            p.setBackupEnabled(!p.backupEnabled());
            AlarmTools.scheduleAll(this);
            refresh();
        });
        backupRow.addView(backupToggle);
        settings.addView(backupRow);
        root.addView(settings);

        root.addView(spacer(16));

        // بطاقة الصلاحيات
        LinearLayout perms = card();
        perms.addView(sectionTitle(getString(R.string.sec_perms)));
        perms.addView(label(getString(R.string.sec_perms_hint), 12,
                getColor(R.color.text_dim), false, 10));
        permsBox = new LinearLayout(this);
        permsBox.setOrientation(LinearLayout.VERTICAL);
        perms.addView(permsBox);
        root.addView(perms);

        root.addView(spacer(16));

        statValue = label("", 12, getColor(R.color.text_dim), false, 6);
        statValue.setGravity(Gravity.CENTER);
        root.addView(statValue);
        TextView foot = label("يعمل التطبيق بلا إنترنت نهائيًا · بياناتك لا تغادر هاتفك", 12,
                getColor(R.color.text_dim), false, 0);
        foot.setGravity(Gravity.CENTER);
        root.addView(foot);

        scroll.addView(root);
        setContentView(scroll);
        refresh();
    }

    private TextView rowValue(LinearLayout parent, Runnable onClick) {
        TextView t = label("", 14, getColor(R.color.accent), true, 0);
        t.setPadding(0, 0, 0, px(12));
        t.setOnClickListener(v -> onClick.run());
        parent.addView(t);
        return t;
    }

    private View settingRow(String title, Object ignored) {
        TextView t = label(title, 13, getColor(R.color.text_dim), false, 2);
        return t;
    }

    private LinearLayout card() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable g = new GradientDrawable();
        g.setColor(getColor(R.color.card));
        g.setCornerRadius(px(18));
        g.setStroke(1, getColor(R.color.card_stroke));
        c.setBackground(g);
        int p = px(18);
        c.setPadding(p, p, p, p);
        return c;
    }

    private TextView sectionTitle(String s) {
        return label(s, 17, getColor(R.color.text_main), true, 12);
    }

    private TextView label(String s, float sizeSp, int color, boolean bold, int bottomMarginDp) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sizeSp);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = px(bottomMarginDp);
        t.setLayoutParams(lp);
        return t;
    }

    private TextView pillLabel(String s, float sizeSp) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sizeSp);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(px(40));
        int p = px(10);
        g.setStroke(1, getColor(R.color.card_stroke));
        t.setBackground(g);
        t.setPadding(px(16), p / 2, px(16), p / 2);
        return t;
    }

    private Button chipButton(String s, boolean granted) {
        Button b = new Button(this);
        b.setText(s);
        b.setTextSize(13);
        b.setAllCaps(false);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setStateListAnimator(null);
        b.setBackground(null);
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(px(30));
        if (granted) {
            g.setColor(0x337BD389);
            b.setTextColor(getColor(R.color.ok_green));
        } else {
            g.setColor(getColor(R.color.accent));
            b.setTextColor(getColor(R.color.bg));
        }
        b.setBackground(g);
        int h = px(16);
        b.setPadding(px(18), h / 2, px(18), h / 2);
        return b;
    }

    private View spacer(int dp) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, px(dp)));
        return v;
    }

    private int px(int dp) {
        return (int) (dp * getResources().getDisplayMetrics().density);
    }

    // ================== التحديث ==================

    private void refresh() {
        Prefs p = Prefs.get(this);
        boolean enabled = p.enabled();

        if (enabled) {
            statusPill.setText(R.string.status_enabled);
            statusPill.setTextColor(getColor(R.color.ok_green));
        } else {
            statusPill.setText(R.string.status_disabled);
            statusPill.setTextColor(getColor(R.color.text_dim));
        }

        btnToggle.setText(enabled ? R.string.btn_disable : R.string.btn_enable);
        GradientDrawable tg = new GradientDrawable();
        tg.setCornerRadius(px(30));
        tg.setColor(enabled ? getColor(R.color.danger) : getColor(R.color.accent));
        btnToggle.setBackground(tg);

        cityValue.setText(p.cityName(this));
        methodValue.setText(Prefs.METHODS[p.methodIndex()][0]);
        int mb = p.minutesBefore();
        minutesValue.setText(mb == 0 ? getString(R.string.minutes_at)
                : "قبل الفجر بـ " + mb + " دقيقة");
        String s = p.soundUri();
        if (s.isEmpty()) soundValue.setText(R.string.sound_default);
        else if ("none".equals(s)) soundValue.setText(R.string.sound_none);
        else {
            String n = p.soundName();
            soundValue.setText(n == null ? getString(R.string.sound_pick) : n);
        }
        backupToggle.setText(p.backupEnabled() ? R.string.backup_on : R.string.backup_off);
        backupToggle.setTextColor(p.backupEnabled()
                ? getColor(R.color.ok_green) : getColor(R.color.text_dim));

        buildPermRows(p);
        statValue.setText(getString(R.string.stat_wakes, p.wakeTotal()));
        updateCountdown();
    }

    private void updateCountdown() {
        Prefs p = Prefs.get(this);
        if (!p.enabled()) {
            nextValue.setText(getString(R.string.no_alarm_today));
            countdownValue.setText(R.string.countdown_none);
            return;
        }
        Calendar f = AlarmTools.nextFajr(this, p, System.currentTimeMillis());
        if (f == null) {
            nextValue.setText(getString(R.string.no_alarm_today));
            countdownValue.setText("");
            return;
        }
        nextValue.setText(AlarmTools.fmtTime(f));
        long diff = f.getTimeInMillis() - System.currentTimeMillis();
        if (diff < 0) diff = 0;
        long h = diff / 3600000;
        long m = (diff % 3600000) / 60000;
        long sec = (diff % 60000) / 1000;
        countdownValue.setText("الباقي " + String.format(java.util.Locale.US,
                "%02d:%02d:%02d", h, m, sec));
    }

    // ================== الصلاحيات ==================

    private boolean hasNotifPermission() {
        if (Build.VERSION.SDK_INT < 33) return true;
        return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    private boolean canFullScreen() {
        if (Build.VERSION.SDK_INT < 34) return true;
        NotificationManager nm = getSystemService(NotificationManager.class);
        return nm != null && nm.canUseFullScreenIntent();
    }

    private boolean ignoringBattery() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
    }

    private void buildPermRows(Prefs p) {
        permsBox.removeAllViews();

        // الإشعارات
        boolean notif = hasNotifPermission();
        permsBox.addView(permRow(getString(R.string.perm_notif_title),
                getString(R.string.perm_notif_desc), notif,
                notif ? null : () -> requestNotifPermission()));

        // فوق شاشة القفل
        boolean fsi = canFullScreen();
        permsBox.addView(permRow(getString(R.string.perm_fsi_title),
                getString(R.string.perm_fsi_desc), fsi,
                fsi ? null : () -> openFullScreenSettings()));

        // البطارية
        boolean batt = ignoringBattery();
        permsBox.addView(permRow(getString(R.string.perm_batt_title),
                getString(R.string.perm_batt_desc), batt,
                batt ? null : () -> requestBatteryException()));

        // الموقع
        permsBox.addView(permRow(getString(R.string.perm_loc_title),
                getString(R.string.perm_loc_desc), p.cityIndex() < 0,
                () -> {
                    if (!hasLocationPermission()) requestLocPermission();
                    else startGpsFix();
                }));
    }

    private LinearLayout permRow(String title, String desc, boolean granted, Runnable grant) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, px(8), 0, px(8));

        LinearLayout texts = new LinearLayout(this);
        texts.setOrientation(LinearLayout.VERTICAL);
        texts.setLayoutParams(new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        TextView t1 = label(title, 15, getColor(R.color.text_main), true, 2);
        texts.addView(t1);
        TextView t2 = label(desc, 12, getColor(R.color.text_dim), false, 0);
        texts.addView(t2);
        row.addView(texts);

        Button chip = chipButton(granted
                ? getString(R.string.perm_granted) : getString(R.string.btn_grant), granted);
        if (grant != null) chip.setOnClickListener(v -> grant.run());
        else chip.setOnClickListener(null);
        row.addView(chip);
        return row;
    }

    private void requestNotifPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
        }
    }

    private void requestLocPermission() {
        requestPermissions(new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
    }

    private void openFullScreenSettings() {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startActivity(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                        Uri.fromParts("package", getPackageName(), null)));
                return;
            }
        } catch (Exception ignored) {
        }
        try {
            startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
        } catch (Exception ignored) {
        }
    }

    private void requestBatteryException() {
        try {
            startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + getPackageName())));
        } catch (Exception e) {
            try {
                startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        refresh();
        if (requestCode == REQ_LOCATION
                && grantResults != null && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startGpsFix();
        }
        if (requestCode == REQ_NOTIF && grantResults != null && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, R.string.perm_notif_ok, Toast.LENGTH_SHORT).show();
        }
    }

    // ================== تحديد الموقع ==================

    private void startGpsFix() {
        try {
            LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (lm == null) {
                Toast.makeText(this, R.string.loc_failed, Toast.LENGTH_LONG).show();
                return;
            }
            Prefs p = Prefs.get(this);
            p.setCity(-1); // وضع GPS
            p.setGpsName(getString(R.string.loc_me));
            refresh();

            gpsListener = new LocationListener() {
                @Override
                public void onLocationChanged(Location location) {
                    stopGps();
                    Prefs.get(MainActivity.this).setGpsLocation(
                            location.getLatitude(), location.getLongitude());
                    Toast.makeText(MainActivity.this, R.string.loc_found, Toast.LENGTH_SHORT).show();
                    AlarmTools.scheduleAll(MainActivity.this);
                    refresh();
                }

                @Override
                public void onProviderDisabled(String provider) {
                }

                @Override
                public void onProviderEnabled(String provider) {
                }
            };
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, gpsListener,
                        Looper.getMainLooper());
            }
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 0, 0, gpsListener,
                        Looper.getMainLooper());
            }
            handler.postDelayed(this::stopGps, 20000);
        } catch (Exception e) {
            Toast.makeText(this, R.string.loc_failed, Toast.LENGTH_LONG).show();
        }
    }

    private void stopGps() {
        if (gpsListener != null) {
            try {
                LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                if (lm != null) lm.removeUpdates(gpsListener);
            } catch (Exception ignored) {
            }
            gpsListener = null;
        }
    }

    // ================== التبديل ==================

    private void onToggle() {
        Prefs p = Prefs.get(this);
        if (p.enabled()) {
            p.setEnabled(false);
            AlarmTools.cancelAll(this);
            Toast.makeText(this, R.string.toast_disabled, Toast.LENGTH_SHORT).show();
        } else {
            if (!hasNotifPermission()) {
                Toast.makeText(this, R.string.toast_need_notif, Toast.LENGTH_LONG).show();
                requestNotifPermission();
                return;
            }
            p.setEnabled(true);
            Calendar f = AlarmTools.scheduleAll(this);
            if (f == null) {
                p.setEnabled(false);
                Toast.makeText(this, R.string.toast_no_fajr, Toast.LENGTH_LONG).show();
            } else {
                Toast.makeText(this, getString(R.string.toast_enabled, AlarmTools.fmtTime(f)),
                        Toast.LENGTH_LONG).show();
            }
        }
        refresh();
    }

    // ================== الحوارات ==================

    private void pickCity() {
        Prefs p = Prefs.get(this);
        String[] names = new String[Prefs.CITIES.length + 1];
        names[0] = "📍 " + getString(R.string.loc_me);
        for (int i = 0; i < Prefs.CITIES.length; i++) names[i + 1] = Prefs.CITIES[i][0];
        int checked = p.cityIndex() < 0 ? 0 : p.cityIndex() + 1;
        new AlertDialog.Builder(this)
                .setTitle(R.string.dialog_city_title)
                .setSingleChoiceItems(names, checked, (dlg, which) -> {
                    if (which == 0) {
                        if (hasLocationPermission()) startGpsFix();
                        else requestLocPermission();
                    } else {
                        Prefs.get(this).setCity(which - 1);
                        AlarmTools.scheduleAll(this);
                    }
                    dlg.dismiss();
                    refresh();
                })
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    private void pickMethod() {
        Prefs p = Prefs.get(this);
        String[] names = new String[Prefs.METHODS.length];
        for (int i = 0; i < Prefs.METHODS.length; i++) names[i] = Prefs.METHODS[i][0];
        new AlertDialog.Builder(this)
                .setTitle(R.string.dialog_method_title)
                .setSingleChoiceItems(names, p.methodIndex(), (dlg, which) -> {
                    Prefs.get(this).setMethod(which);
                    AlarmTools.scheduleAll(this);
                    dlg.dismiss();
                    refresh();
                })
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    private void pickMinutes() {
        Prefs p = Prefs.get(this);
        int cur = p.minutesBefore();
        int checked = 0;
        for (int i = 0; i < MINUTES_OPTIONS.length; i++) {
            if (MINUTES_OPTIONS[i] == cur) checked = i;
        }
        String[] labels = new String[MINUTES_OPTIONS.length];
        for (int i = 0; i < MINUTES_OPTIONS.length; i++) {
            labels[i] = MINUTES_OPTIONS[i] == 0 ? getString(R.string.minutes_at)
                    : "قبل الفجر بـ " + MINUTES_OPTIONS[i] + " دقيقة";
        }
        new AlertDialog.Builder(this)
                .setTitle(R.string.dialog_minutes_title)
                .setSingleChoiceItems(labels, checked, (dlg, which) -> {
                    Prefs.get(this).setMinutesBefore(MINUTES_OPTIONS[which]);
                    AlarmTools.scheduleAll(this);
                    dlg.dismiss();
                    refresh();
                })
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    private void pickSound() {
        Prefs p = Prefs.get(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        int pad = px(20);
        box.setPadding(pad, pad / 2, pad, 0);

        RadioGroup group = new RadioGroup(this);
        rbDefault = new RadioButton(this);
        rbDefault.setText(R.string.sound_default);
        rbPick = new RadioButton(this);
        rbPick.setText(R.string.sound_pick);
        rbNone = new RadioButton(this);
        rbNone.setText(R.string.sound_none);
        group.addView(rbDefault);
        group.addView(rbPick);
        group.addView(rbNone);
        box.addView(group);

        String cur = p.soundUri();
        if ("none".equals(cur)) rbNone.setChecked(true);
        else if (cur.isEmpty()) rbDefault.setChecked(true);
        else {
            rbPick.setChecked(true);
            String n = p.soundName();
            if (n != null) rbPick.setText(n);
        }
        rbPick.setOnCheckedChangeListener((b, checked) -> {
            if (checked) {
                launchSoundPicker();
            }
        });

        LinearLayout testRow = new LinearLayout(this);
        testRow.setOrientation(LinearLayout.HORIZONTAL);
        testRow.setPadding(0, px(12), 0, 0);
        Button test = chipButton(getString(R.string.btn_test_sound), false);
        test.setOnClickListener(v -> {
            Intent i = new Intent(this, AlarmService.class).putExtra("test", true);
            startForegroundService(i);
            Toast.makeText(this, R.string.toast_test, Toast.LENGTH_SHORT).show();
        });
        Button stopTest = chipButton(getString(R.string.btn_test_stop), true);
        stopTest.setOnClickListener(v -> AlarmService.stop(this));
        testRow.addView(test);
        testRow.addView(spacer(8));
        testRow.addView(stopTest);
        box.addView(testRow);

        soundDialog = new AlertDialog.Builder(this)
                .setTitle(R.string.dialog_sound_title)
                .setView(box)
                .setPositiveButton(R.string.save, (dlg, w) -> {
                    AlarmService.stop(this);
                    if (rbDefault.isChecked()) {
                        p.setSoundUri("");
                        p.setSoundName(null);
                        Toast.makeText(this, R.string.sound_reset, Toast.LENGTH_SHORT).show();
                    } else if (rbNone.isChecked()) {
                        p.setSoundUri("none");
                        p.setSoundName(null);
                    }
                    // rbPick: يُحفظ في onActivityResult عند العودة بالملف
                    refresh();
                })
                .setNegativeButton(R.string.cancel, (dlg, w) -> AlarmService.stop(this))
                .show();
    }

    private void launchSoundPicker() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("audio/*");
        try {
            startActivityForResult(i, REQ_SOUND_PICK);
        } catch (Exception e) {
            Toast.makeText(this, R.string.loc_failed, Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_SOUND_PICK && resultCode == RESULT_OK && data != null
                && data.getData() != null) {
            pendingPickUri = data.getData();
            try {
                getContentResolver().takePersistableUriPermission(pendingPickUri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (Exception ignored) {
            }
            Prefs p = Prefs.get(this);
            p.setSoundUri(pendingPickUri.toString());
            String name = queryFileName(pendingPickUri);
            p.setSoundName(name);
            if (rbPick != null) rbPick.setText(name);
            Toast.makeText(this, R.string.sound_set, Toast.LENGTH_SHORT).show();
        }
    }

    private String queryFileName(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) {
                    String n = c.getString(idx);
                    if (n != null && !n.isEmpty()) return n;
                }
            }
        } catch (Exception ignored) {
        }
        return "أذان مخصص";
    }
}
