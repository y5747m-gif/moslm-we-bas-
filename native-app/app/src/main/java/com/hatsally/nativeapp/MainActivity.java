package com.hatsally.nativeapp;

import android.app.TimePickerDialog;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.app.AppCompatDelegate;
import com.google.android.material.switchmaterial.SwitchMaterial;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * الشاشة الرئيسية: عدة منبهات للفجر 🕌
 * ---------------------------------------------------------------
 * واجهة أصلية (Native) - شكل مختلف تماماً عن الموقع.
 * الساعة المعروضة = ساعة الهاتف الحقيقية (تحديث كل ثانية).
 * كل منبه مستقل: وقت + أيام + مدة + تفعيل/تعطيل + حذف.
 */
public class MainActivity extends AppCompatActivity {

    private TextView clockTime;
    private TextView clockDate;
    private TextView statusActive;
    private TextView statusNext;
    private LinearLayout alarmsContainer;
    private TextView noAlarmsText;
    private View addButton;

    // نموذج الإضافة/التعديل
    private View formCard;
    private TextView formTitle;
    private EditText nameInput;
    private TextView timeButton;
    private TextView[] dayToggles;
    private RadioGroup durationGroup;
    private EditText customDaysInput;
    private View customDaysRow;
    private View saveButton;
    private View deleteButton;
    private View cancelFormButton;

    private final Handler clockHandler = new Handler(Looper.getMainLooper());
    private final Runnable clockRunnable = new Runnable() {
        @Override
        public void run() {
            updateClock();
            updateStatus();
            clockHandler.postDelayed(this, 1000);
        }
    };

    private String lang = "ar";
    private int editingId = -1; // -1 = منبه جديد
    private int[] daysSel = {0, 1, 2, 3, 4, 5, 6};
    private boolean switchingProgrammatically = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        lang = AlarmPrefs.loadLang(this);
        applyLanguage();
        super.onCreate(savedInstanceState);
        applyTheme();
        setContentView(R.layout.activity_main);

        clockTime = (TextView) findViewById(R.id.clock_time);
        clockDate = (TextView) findViewById(R.id.clock_date);
        statusActive = (TextView) findViewById(R.id.status_active);
        statusNext = (TextView) findViewById(R.id.status_next);
        alarmsContainer = (LinearLayout) findViewById(R.id.alarms_container);
        noAlarmsText = (TextView) findViewById(R.id.no_alarms_text);
        addButton = findViewById(R.id.btn_add);

        formCard = findViewById(R.id.form_card);
        formTitle = (TextView) findViewById(R.id.form_title);
        nameInput = (EditText) findViewById(R.id.name_input);
        timeButton = (TextView) findViewById(R.id.time_button);
        durationGroup = (RadioGroup) findViewById(R.id.duration_group);
        customDaysInput = (EditText) findViewById(R.id.custom_days_input);
        customDaysRow = findViewById(R.id.custom_days_row);
        saveButton = findViewById(R.id.btn_save);
        deleteButton = findViewById(R.id.btn_delete);
        cancelFormButton = findViewById(R.id.btn_cancel_form);

        dayToggles = new TextView[7];
        dayToggles[0] = (TextView) findViewById(R.id.day_sun);
        dayToggles[1] = (TextView) findViewById(R.id.day_mon);
        dayToggles[2] = (TextView) findViewById(R.id.day_tue);
        dayToggles[3] = (TextView) findViewById(R.id.day_wed);
        dayToggles[4] = (TextView) findViewById(R.id.day_thu);
        dayToggles[5] = (TextView) findViewById(R.id.day_fri);
        dayToggles[6] = (TextView) findViewById(R.id.day_sat);
        for (int i = 0; i < 7; i++) {
            final int idx = i;
            dayToggles[i].setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    toggleDay(idx);
                }
            });
        }

        timeButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openTimePicker();
            }
        });

        addButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAddForm();
            }
        });
        TextView tryButton = (TextView) findViewById(R.id.btn_try);
        tryButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                JSONObject a = AlarmPrefs.firstActiveAlarm(MainActivity.this);
                int id = a != null ? a.optInt("id", 0) : (editingId > 0 ? editingId : 0);
                Intent i = new Intent(MainActivity.this, AlarmActivity.class);
                i.putExtra(AlarmActivity.EXTRA_DEMO, true);
                i.putExtra(AlarmActivity.EXTRA_ALARM_ID, id);
                startActivity(i);
            }
        });
        saveButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                saveForm();
            }
        });
        deleteButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                confirmDelete(editingId);
            }
        });
        cancelFormButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                hideForm();
            }
        });

        durationGroup.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(RadioGroup group, int checkedId) {
                boolean custom = ((RadioButton) findViewById(R.id.dur_custom)).isChecked();
                customDaysRow.setVisibility(custom ? View.VISIBLE : View.GONE);
            }
        });

        // تبديل اللغة (عربي/إنجليزي)
        TextView langButton = (TextView) findViewById(R.id.lang_button);
        langButton.setText("ar".equals(lang) ? "EN" : "ع");
        langButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                lang = "ar".equals(lang) ? "en" : "ar";
                AlarmPrefs.setLang(MainActivity.this, lang);
                applyLanguage();
                recreate();
            }
        });

        // تبديل المظهر (داكن/فاتح)
        TextView themeButton = (TextView) findViewById(R.id.theme_button);
        themeButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                int mode = AppCompatDelegate.getDefaultNightMode();
                int next = mode == AppCompatDelegate.MODE_NIGHT_NO
                        ? AppCompatDelegate.MODE_NIGHT_YES
                        : AppCompatDelegate.MODE_NIGHT_NO;
                AppCompatDelegate.setDefaultNightMode(next);
                AlarmPrefs.setTheme(MainActivity.this,
                        next == AppCompatDelegate.MODE_NIGHT_NO ? "light" : "dark");
                recreate();
            }
        });

        // مزامنة مع رنين النظام: لو منبه يرن الآن → شاشة الرنين
        if (AlarmService.isRunning() && !isFinishing()) {
            Intent i = new Intent(this, AlarmActivity.class);
            i.putExtra(AlarmActivity.EXTRA_ALARM_ID, AlarmService.ringingId());
            startActivity(i);
        }

        // إعادة مزامنة كل المواعيد على ساعة الهاتف + لحاق 45 دقيقة
        rearmAndCatchUp();

        handleIntent(getIntent());
        renderAlarms();
        updateStatus();
    }

    private void handleIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        if ("hatsally".equals(intent.getData().getScheme()) && AlarmService.isRunning()) {
            Intent i = new Intent(this, AlarmActivity.class);
            i.putExtra(AlarmActivity.EXTRA_ALARM_ID, AlarmService.ringingId());
            startActivity(i);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    // ------------------------------------------------------------------
    // اللغة والمظهر
    // ------------------------------------------------------------------
    private void applyLanguage() {
        Locale l = "en".equals(lang) ? Locale.ENGLISH : Locale.forLanguageTag("ar");
        Locale.setDefault(l);
        Configuration cfg = getResources().getConfiguration();
        cfg.setLocale(l);
        getResources().updateConfiguration(cfg, getResources().getDisplayMetrics());
    }

    private void applyTheme() {
        String theme = AlarmPrefs.loadTheme(this);
        AppCompatDelegate.setDefaultNightMode(
                "light".equals(theme)
                        ? AppCompatDelegate.MODE_NIGHT_NO
                        : AppCompatDelegate.MODE_NIGHT_YES);
    }

    // ------------------------------------------------------------------
    // ساعة الهاتف الحية + الحالة
    // ------------------------------------------------------------------
    private void updateClock() {
        Locale l = "en".equals(lang) ? Locale.ENGLISH : Locale.forLanguageTag("ar");
        SimpleDateFormat timeF = new SimpleDateFormat("HH:mm:ss", Locale.US);
        SimpleDateFormat dateF = new SimpleDateFormat("EEEE  •  d MMMM", l);
        Date now = new Date();
        clockTime.setText(timeF.format(now));
        clockDate.setText(dateF.format(now));
    }

    private void updateStatus() {
        int active = AlarmPrefs.countActive(this);
        statusActive.setText(getString(R.string.active_count, String.valueOf(active)));
        long nearest = AlarmPrefs.nearestNext(this, Calendar.getInstance());
        if (nearest > 0) {
            long diff = nearest - System.currentTimeMillis();
            if (diff < 0) diff = 0;
            long h = diff / 3600000;
            long m = (diff % 3600000) / 60000;
            long s = (diff % 60000) / 1000;
            statusNext.setText(getString(R.string.next_ring_any,
                    AlarmPrefs.formatTime(nearest),
                    h + " " + getString(R.string.cd_h) + " "
                            + m + " " + getString(R.string.cd_m) + " "
                            + s + " " + getString(R.string.cd_s)));
        } else {
            statusNext.setText(getString(R.string.no_next_ring));
        }
    }

    // ------------------------------------------------------------------
    // عرض قائمة المنبهات
    // ------------------------------------------------------------------
    private void renderAlarms() {
        alarmsContainer.removeAllViews();
        JSONArray alarms = AlarmPrefs.loadAlarms(this);
        noAlarmsText.setVisibility(alarms.length() == 0 ? View.VISIBLE : View.GONE);

        for (int i = 0; i < alarms.length(); i++) {
            final JSONObject a = alarms.optJSONObject(i);
            if (a == null) continue;
            final int id = a.optInt("id", 0);

            View card = LayoutInflater.from(this).inflate(R.layout.card_alarm, alarmsContainer, false);
            TextView timeText = (TextView) card.findViewById(R.id.card_time);
            TextView nameText = (TextView) card.findViewById(R.id.card_name);
            TextView daysText = (TextView) card.findViewById(R.id.card_days);
            TextView durationText = (TextView) card.findViewById(R.id.card_duration);
            SwitchMaterial sw = (SwitchMaterial) card.findViewById(R.id.card_switch);
            TextView del = (TextView) card.findViewById(R.id.card_delete);
            View body = card.findViewById(R.id.card_body);

            timeText.setText(a.optString("time", "--:--"));
            String name = a.optString("name", "");
            nameText.setText(name.isEmpty()
                    ? getString(R.string.untitled_alarm)
                    : name + (a.optBoolean("active", false) ? "" : "  " + getString(R.string.alarm_paused)));
            daysText.setText(daysShort(a.optJSONArray("days")));
            int dur = a.optInt("duration", 0);
            if (dur == 0) {
                durationText.setText(getString(R.string.dur_forever_short));
            } else {
                durationText.setText(getString(R.string.dur_days_short, String.valueOf(dur)));
            }

            switchingProgrammatically = true;
            sw.setChecked(a.optBoolean("active", false));
            switchingProgrammatically = false;
            sw.setOnCheckedChangeListener(new android.widget.CompoundButton.OnCheckedChangeListener() {
                @Override
                public void onCheckedChanged(android.widget.CompoundButton buttonView, boolean isChecked) {
                    if (switchingProgrammatically) return;
                    AlarmPrefs.setActive(MainActivity.this, id, isChecked);
                    rearmAfterChange();
                    renderAlarms();
                }
            });

            body.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    editAlarm(id);
                }
            });
            del.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    confirmDelete(id);
                }
            });

            alarmsContainer.addView(card);
        }
    }

    private String daysShort(JSONArray days) {
        String[] labels = getResources().getStringArray(R.array.day_short);
        if (days == null || days.length() == 0) return getString(R.string.days_all);
        if (days.length() == 7) return getString(R.string.days_all);
        StringBuilder sb = new StringBuilder();
        // ترتيب عرض: الأحد → السبت
        for (int d = 0; d < 7; d++) {
            boolean has = false;
            for (int i = 0; i < days.length(); i++) {
                if (days.optInt(i, -1) == d) {
                    has = true;
                    break;
                }
            }
            if (has) {
                if (sb.length() > 0) sb.append(" ");
                sb.append(labels[d]);
            }
        }
        return sb.length() == 0 ? getString(R.string.days_all) : sb.toString();
    }

    // ------------------------------------------------------------------
    // النموذج: إضافة / تعديل
    // ------------------------------------------------------------------
    private void showAddForm() {
        editingId = -1;
        formTitle.setText(getString(R.string.form_title_new));
        nameInput.setText("");
        Calendar c = Calendar.getInstance();
        c.add(Calendar.MINUTE, 30);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        timeButton.setText(String.format("%02d:%02d",
                c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE)));
        daysSel = new int[]{0, 1, 2, 3, 4, 5, 6};
        refreshDayToggles();
        ((RadioButton) findViewById(R.id.dur_forever)).setChecked(true);
        customDaysInput.setText("");
        customDaysRow.setVisibility(View.GONE);
        deleteButton.setVisibility(View.GONE);
        formCard.setVisibility(View.VISIBLE);
    }

    private void editAlarm(int id) {
        JSONObject a = AlarmPrefs.findAlarm(this, id);
        if (a == null) return;
        editingId = id;
        formTitle.setText(getString(R.string.form_title_edit));
        nameInput.setText(a.optString("name", ""));
        String t = a.optString("time", "05:00");
        timeButton.setText(t.length() == 5 ? t : "05:00");
        JSONArray days = a.optJSONArray("days");
        if (days != null && days.length() > 0) {
            int[] arr = new int[days.length()];
            for (int i = 0; i < days.length(); i++) arr[i] = days.optInt(i, 0);
            Arrays.sort(arr);
            daysSel = arr;
        } else {
            daysSel = new int[]{0, 1, 2, 3, 4, 5, 6};
        }
        refreshDayToggles();
        int dur = a.optInt("duration", 0);
        if (dur == 7) ((RadioButton) findViewById(R.id.dur_7)).setChecked(true);
        else if (dur == 14) ((RadioButton) findViewById(R.id.dur_14)).setChecked(true);
        else if (dur == 30) ((RadioButton) findViewById(R.id.dur_30)).setChecked(true);
        else if (dur > 0) {
            ((RadioButton) findViewById(R.id.dur_custom)).setChecked(true);
            customDaysInput.setText(String.valueOf(dur));
            customDaysRow.setVisibility(View.VISIBLE);
        } else {
            ((RadioButton) findViewById(R.id.dur_forever)).setChecked(true);
        }
        deleteButton.setVisibility(View.VISIBLE);
        formCard.setVisibility(View.VISIBLE);
    }

    private void hideForm() {
        formCard.setVisibility(View.GONE);
        editingId = -1;
    }

    private int durationValue() {
        int id = durationGroup.getCheckedRadioButtonId();
        if (id == R.id.dur_forever) return 0;
        if (id == R.id.dur_7) return 7;
        if (id == R.id.dur_14) return 14;
        if (id == R.id.dur_30) return 30;
        try {
            int c = Integer.parseInt(customDaysInput.getText().toString().trim());
            if (c > 0) return Math.min(c, 365);
        } catch (Exception ignored) {}
        return 0;
    }

    private void saveForm() {
        String name = nameInput.getText().toString().trim();
        if (name.isEmpty()) {
            Toast.makeText(this, getString(R.string.need_name), Toast.LENGTH_SHORT).show();
            return;
        }
        String time = timeButton.getText().toString();
        if (time.length() != 5) {
            time = "05:00";
        }
        if (daysSel.length == 0) {
            Toast.makeText(this, getString(R.string.need_day), Toast.LENGTH_SHORT).show();
            return;
        }

        askPermissionsThen(() -> {
            JSONObject a;
            if (editingId > 0) {
                JSONObject old = AlarmPrefs.findAlarm(this, editingId);
                a = old != null ? old : new JSONObject();
                try {
                    a.put("id", editingId);
                } catch (Exception ignored) {}
            } else {
                a = new JSONObject();
            }
            try {
                a.put("name", name);
                a.put("time", time);
                JSONArray days = new JSONArray();
                for (int d : daysSel) days.put(d);
                a.put("days", days);
                a.put("duration", durationValue());
                if (a.optInt("duration", 0) > 0 && a.optString("startDate", "").isEmpty()) {
                    a.put("startDate", AlarmPrefs.todayKey(Calendar.getInstance()));
                }
                if (a.optInt("duration", 0) == 0) {
                    a.put("startDate", "");
                }
                a.put("active", true);
                if (!a.has("lastFiredKey")) a.put("lastFiredKey", "");
            } catch (Exception ignored) {}

            if (editingId > 0) {
                AlarmPrefs.updateAlarm(this, editingId, a);
            } else {
                AlarmPrefs.addAlarm(this, a);
            }
            hideForm();
            rearmAfterChange();
            renderAlarms();
            updateStatus();
            Toast.makeText(this,
                    getString(R.string.set_ok, time),
                    Toast.LENGTH_LONG).show();
        });
    }

    private void confirmDelete(final int id) {
        new AlertDialog.Builder(this)
                .setTitle(getString(R.string.delete_confirm_title))
                .setMessage(getString(R.string.delete_confirm_msg))
                .setPositiveButton(R.string.delete_yes, new android.content.DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(android.content.DialogInterface dialog, int which) {
                        AlarmPrefs.removeAlarm(MainActivity.this, id);
                        if (editingId == id) hideForm();
                        rearmAfterChange();
                        renderAlarms();
                        updateStatus();
                    }
                })
                .setNegativeButton(R.string.delete_no, null)
                .show();
    }

    // ------------------------------------------------------------------
    // الأذونات ثم الحفظ
    // ------------------------------------------------------------------
    private void askPermissionsThen(final Runnable proceed) {
        // 1) الإشعارات (أندرويد 13+)
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 71);
            }
        }
        // 2) المنبه الدقيق (أندرويد 12+)
        if (!AlarmScheduler.canScheduleExact(this)) {
            AlarmScheduler.openExactAlarmSettings(this);
            Toast.makeText(this, getString(R.string.exact_hint), Toast.LENGTH_LONG).show();
        }
        // 3) تحسين البطارية (مستحسن)
        if (!AlarmScheduler.isIgnoringBatteryOptimizations(this)) {
            AlarmScheduler.requestIgnoreBatteryOptimizations(this);
            Toast.makeText(this, getString(R.string.battery_hint), Toast.LENGTH_LONG).show();
        }
        proceed.run();
    }

    // ------------------------------------------------------------------
    // إعادة الضبط + اللحاق
    // ------------------------------------------------------------------
    private void rearmAfterChange() {
        AlarmScheduler.armAll(this);
    }

    private void rearmAndCatchUp() {
        // إعادة مزامنة كل المواعيد (التطبيق انفتح) - فلا يضيع منبه أبداً
        AlarmScheduler.armAll(this);

        // لحاق 45 دقيقة: فاتها الموعد بقليل ولم يرنّ اليوم → نرنّ الآن
        try {
            if (!AlarmService.isRunning()) {
                Calendar now = Calendar.getInstance();
                String today = AlarmPrefs.todayKey(now);
                int dow = now.get(Calendar.DAY_OF_WEEK) - 1; // 0=الأحد
                JSONArray alarms = AlarmPrefs.loadAlarms(this);
                for (int i = 0; i < alarms.length(); i++) {
                    JSONObject a = alarms.optJSONObject(i);
                    if (a == null || !a.optBoolean("active", false)) continue;
                    if (today.equals(a.optString("lastFiredKey", ""))) continue;
                    if (!AlarmPrefs.dayMatches(a, dow)) continue;
                    if (AlarmPrefs.isExpired(this, a, now)) continue;
                    String time = a.optString("time", "");
                    String[] p = time.split(":");
                    if (p.length < 2) continue;
                    int h, m;
                    try {
                        h = Integer.parseInt(p[0]);
                        m = Integer.parseInt(p[1]);
                    } catch (Exception e) {
                        continue;
                    }
                    Calendar scheduled = (Calendar) now.clone();
                    scheduled.set(Calendar.HOUR_OF_DAY, h);
                    scheduled.set(Calendar.MINUTE, m);
                    scheduled.set(Calendar.SECOND, 0);
                    scheduled.set(Calendar.MILLISECOND, 0);
                    long diffMin = (now.getTimeInMillis() - scheduled.getTimeInMillis()) / 60000L;
                    if (diffMin >= 0 && diffMin <= 45) {
                        int id = a.optInt("id", 0);
                        AlarmPrefs.setLastFired(this, id, today);
                        try {
                            Intent svc = new Intent(this, AlarmService.class);
                            svc.putExtra(AlarmService.EXTRA_ALARM_ID, id);
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                startForegroundService(svc);
                            } else {
                                startService(svc);
                            }
                        } catch (Exception ignored) {}
                        Intent act = new Intent(this, AlarmActivity.class);
                        act.putExtra(AlarmActivity.EXTRA_ALARM_ID, id);
                        startActivity(act);
                        return;
                    }
                }
            }
        } catch (Exception ignored) {}
        updatePermissionUI();
    }

    private void updatePermissionUI() {
        TextView permExact = (TextView) findViewById(R.id.perm_exact);
        TextView permNotif = (TextView) findViewById(R.id.perm_notif);
        TextView permBattery = (TextView) findViewById(R.id.perm_battery);
        boolean exact = AlarmScheduler.canScheduleExact(this);
        boolean notif = Build.VERSION.SDK_INT < 33
                || checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PERMISSION_GRANTED;
        boolean battery = AlarmScheduler.isIgnoringBatteryOptimizations(this);
        permExact.setText((exact ? "✓ " : "• ") + getString(R.string.perm_exact) + (exact ? "" : " !"));
        permExact.setTextColor(exact ? getResources().getColor(R.color.perm_ok) : getResources().getColor(R.color.perm_warn));
        permNotif.setText((notif ? "✓ " : "• ") + getString(R.string.perm_notif) + (notif ? "" : " !"));
        permNotif.setTextColor(notif ? getResources().getColor(R.color.perm_ok) : getResources().getColor(R.color.perm_warn));
        permBattery.setText((battery ? "✓ " : "• ") + getString(R.string.perm_battery) + (battery ? "" : " !"));
        permBattery.setTextColor(battery ? getResources().getColor(R.color.perm_ok) : getResources().getColor(R.color.perm_warn));
    }

    // ------------------------------------------------------------------
    // أيام الأسبوع
    // ------------------------------------------------------------------
    private void toggleDay(int idx) {
        List<Integer> list = new java.util.ArrayList<Integer>();
        for (int d : daysSel) list.add(d);
        if (list.contains(idx)) {
            list.remove(Integer.valueOf(idx));
        } else {
            list.add(idx);
        }
        int[] arr = new int[list.size()];
        for (int i = 0; i < arr.length; i++) arr[i] = list.get(i);
        Arrays.sort(arr);
        daysSel = arr;
        refreshDayToggles();
    }

    private void refreshDayToggles() {
        for (int i = 0; i < 7; i++) {
            boolean sel = false;
            for (int d : daysSel) if (d == i) sel = true;
            dayToggles[i].setBackgroundResource(sel ? R.drawable.bg_day_on : R.drawable.bg_day_off);
            dayToggles[i].setTextColor(sel ? 0xFF06120F : getResources().getColor(R.color.day_text_off));
            dayToggles[i].setTypeface(null, sel ? Typeface.BOLD : Typeface.NORMAL);
        }
    }

    // ------------------------------------------------------------------
    // TimePicker
    // ------------------------------------------------------------------
    private void openTimePicker() {
        int h = 5, m = 0;
        try {
            String[] p = timeButton.getText().toString().split(":");
            h = Integer.parseInt(p[0]);
            m = Integer.parseInt(p[1]);
        } catch (Exception ignored) {}
        TimePickerDialog d = new TimePickerDialog(this,
                new TimePickerDialog.OnTimeSetListener() {
                    @Override
                    public void onTimeSet(android.widget.TimePicker view, int hourOfDay, int minute) {
                        timeButton.setText(String.format("%02d:%02d", hourOfDay, minute));
                    }
                }, h, m, true);
        d.show();
    }

    // ------------------------------------------------------------------
    @Override
    protected void onResume() {
        super.onResume();
        clockHandler.post(clockRunnable);
        updatePermissionUI();
        renderAlarms();
        updateStatus();
    }

    @Override
    protected void onPause() {
        super.onPause();
        clockHandler.removeCallbacks(clockRunnable);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        updatePermissionUI();
    }
}
