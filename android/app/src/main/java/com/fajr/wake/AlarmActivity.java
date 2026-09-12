package com.fajr.wake;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * شاشة المنبه كاملة الشاشة: تظهر فوق شاشة القفل وتُشغّل الشاشة،
 * ولا يمكن صمت المنبه إلا بمواجهة الشاشة وضغط الزر.
 */
public class AlarmActivity extends Activity {

    public static final int MAX_SNOOZES = 3;
    private int snoozeLeft;
    private TextView snoozeInfo;
    private Button btnSnooze;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // إيقاظ الشاشة والظهور فوق القفل
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }

        snoozeLeft = Math.max(0, MAX_SNOOZES - Prefs.get(this).snoozeCount());

        boolean backup = AlarmTools.ACTION_BACKUP.equals(getIntent().getAction());
        Intent svc = new Intent(this, AlarmService.class);
        if (backup) svc.setAction(AlarmTools.ACTION_BACKUP);
        if (Build.VERSION.SDK_INT >= 26) {
            startForegroundService(svc);
        } else {
            startService(svc);
        }

        buildUi();
    }

    private void buildUi() {
        float d = getResources().getDisplayMetrics().density;
        int main = getColor(R.color.text_main);
        int dim = getColor(R.color.text_dim);
        int accent = getColor(R.color.accent);
        int bg = getColor(R.color.bg);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(bg);
        root.setPadding((int) (28 * d), (int) (24 * d), (int) (28 * d), (int) (24 * d));

        TextView moon = new TextView(this);
        moon.setText("🌙");
        moon.setTextSize(62);
        moon.setGravity(Gravity.CENTER);
        root.addView(moon);

        root.addView(spacer(18, d));

        root.addView(label(getString(R.string.alarm_title), 28, accent, true, 4));
        root.addView(label(getString(R.string.alarm_sub), 18, main, false, 2));
        root.addView(label(getString(R.string.alarm_verse), 14, dim, false, 2));

        root.addView(spacer(30, d));

        Button stop = pillButton(getString(R.string.btn_stop), accent, bg, (int) (62 * d));
        stop.setOnClickListener(v -> {
            AlarmService.stop(this);
            AlarmTools.cancelBackup(this);
            AlarmTools.cancelSnooze(this);
            finish();
        });
        root.addView(stop);

        root.addView(spacer(14, d));

        btnSnooze = pillButton(getString(R.string.btn_snooze), getColor(R.color.card), dim, (int) (54 * d));
        btnSnooze.setOnClickListener(v -> {
            if (snoozeLeft <= 0) return;
            Prefs.get(this).setSnoozeCount(Prefs.get(this).snoozeCount() + 1);
            AlarmTools.snooze(this, 5);
            AlarmService.stop(this);
            finish();
        });
        root.addView(btnSnooze);

        snoozeInfo = label(getString(R.string.snooze_left, snoozeLeft), 13, dim, false, 0);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = (int) (12 * d);
        snoozeInfo.setLayoutParams(lp);
        root.addView(snoozeInfo);
        refreshSnoozeUi();

        setContentView(root);
    }

    private void refreshSnoozeUi() {
        if (snoozeLeft <= 0) {
            btnSnooze.setEnabled(false);
            btnSnooze.setAlpha(0.4f);
            snoozeInfo.setText(getString(R.string.snooze_left, 0));
        } else {
            snoozeInfo.setText(getString(R.string.snooze_left, snoozeLeft));
        }
    }

    private TextView label(String s, float sizeSp, int color, boolean bold, int marginBottomDp) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sizeSp);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        float d = getResources().getDisplayMetrics().density;
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = (int) (marginBottomDp * d);
        t.setLayoutParams(lp);
        return t;
    }

    private Button pillButton(String text, int bgColor, int textColor, int heightPx) {
        float d = getResources().getDisplayMetrics().density;
        Button b = new Button(this);
        b.setText(text);
        b.setTextSize(19);
        b.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        b.setTextColor(textColor);
        b.setAllCaps(false);
        b.setBackground(null);
        GradientDrawable g = new GradientDrawable();
        g.setColor(bgColor);
        g.setCornerRadius(32 * d);
        b.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, heightPx);
        b.setLayoutParams(lp);
        b.setStateListAnimator(null);
        return b;
    }

    private View spacer(int heightDp, float d) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, (int) (heightDp * d)));
        return v;
    }
}
