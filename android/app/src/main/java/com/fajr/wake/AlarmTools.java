package com.fajr.wake;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import java.util.Calendar;

/** جدولة المنبهات والإشعارات */
public final class AlarmTools {
    private AlarmTools() {}

    public static final String CHANNEL = "fajr_alarm";
    public static final int NOTIF_ID = 2001;

    public static final int REQ_MAIN = 1001;
    public static final int REQ_BACKUP = 1002;
    public static final int REQ_SNOOZE = 1003;

    public static final String ACTION_MAIN = "com.fajr.wake.ALARM_MAIN";
    public static final String ACTION_BACKUP = "com.fajr.wake.ALARM_BACKUP";
    public static final String ACTION_SNOOZE = "com.fajr.wake.ALARM_SNOOZE";

    public static void ensureChannel(Context ctx) {
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL, ctx.getString(R.string.channel_name), NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription(ctx.getString(R.string.channel_desc));
        ch.enableVibration(true);
        ch.setSound(null, null); // الصوت يشغّله التطبيق نفسه عبر مشغّل المنبه
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    /** الفجر القادم ابتداءً من لحظة fromMillis */
    public static Calendar nextFajr(Context ctx, Prefs p, long fromMillis) {
        Calendar probe = Calendar.getInstance();
        probe.setTimeInMillis(fromMillis);
        for (int i = 0; i < 3; i++) {
            double tz1 = p.zone().getOffset(probe.getTimeInMillis()) / 3600000.0;
            Calendar f = PrayerTimes.fajrOn(probe, p.lat(), p.lng(), tz1, p.angle());
            if (f != null) {
                // تمريرة ثانية لضبط التوقيت الصيفي في لحظة الفجر نفسها
                double tz2 = p.zone().getOffset(f.getTimeInMillis()) / 3600000.0;
                if (Math.abs(tz2 - tz1) > 1e-9) {
                    f = PrayerTimes.fajrOn(probe, p.lat(), p.lng(), tz2, p.angle());
                }
            }
            if (f != null && f.getTimeInMillis() > fromMillis) return f;
            probe.add(Calendar.DAY_OF_MONTH, 1);
            probe.set(Calendar.HOUR_OF_DAY, 0);
            probe.set(Calendar.MINUTE, 0);
            probe.set(Calendar.SECOND, 0);
            probe.set(Calendar.MILLISECOND, 0);
        }
        return null;
    }

    /** جدولة الفجر القادم + المنبه الاحتياطي، مع إلغاء الغفوة القديمة */
    public static Calendar scheduleAll(Context ctx) {
        Prefs p = Prefs.get(ctx);
        if (!p.enabled()) {
            cancelAll(ctx);
            return null;
        }
        Calendar fajr = nextFajr(ctx, p, System.currentTimeMillis());
        if (fajr == null) return null;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return fajr;
        long mainAt = fajr.getTimeInMillis() - p.minutesBefore() * 60000L;
        setAlarmClock(ctx, am, mainAt, REQ_MAIN, ACTION_MAIN);
        if (p.backupEnabled()) {
            setAlarmClock(ctx, am, mainAt + 10 * 60000L, REQ_BACKUP, ACTION_BACKUP);
        }
        cancelSnooze(ctx);
        return fajr;
    }

    public static void snooze(Context ctx, int minutes) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        setAlarmClock(ctx, am, System.currentTimeMillis() + minutes * 60000L,
                REQ_SNOOZE, ACTION_SNOOZE);
    }

    private static void setAlarmClock(Context ctx, AlarmManager am, long at, int req, String action) {
        Intent i = new Intent(ctx, AlarmReceiver.class).setAction(action);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, req, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent show = new Intent(ctx, MainActivity.class);
        PendingIntent showPi = PendingIntent.getActivity(ctx, req, show,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showPi), pi);
    }

    public static void cancelAll(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.cancel(pending(ctx, REQ_MAIN, ACTION_MAIN));
        am.cancel(pending(ctx, REQ_BACKUP, ACTION_BACKUP));
        cancelSnooze(ctx);
    }

    public static void cancelSnooze(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.cancel(pending(ctx, REQ_SNOOZE, ACTION_SNOOZE));
    }

    /** إلغاء منبه اليوم الاحتياطي فقط (دون المساس بمنبه الغد) */
    public static void cancelBackup(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.cancel(pending(ctx, REQ_BACKUP, ACTION_BACKUP));
    }

    private static PendingIntent pending(Context ctx, int req, String action) {
        Intent i = new Intent(ctx, AlarmReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(ctx, req, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** إشعار شاشة كاملة يوقظ الجهاز ويعرض شاشة المنبه */
    public static void postAlarmNotification(Context ctx, boolean backup) {
        ensureChannel(ctx);
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        Intent open = new Intent(ctx, AlarmActivity.class)
                .setAction(backup ? ACTION_BACKUP : ACTION_MAIN)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent content = PendingIntent.getActivity(ctx, 3001, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent fsi = PendingIntent.getActivity(ctx, 3002, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = new Notification.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(ctx.getString(backup
                        ? R.string.notif_backup_title : R.string.notif_title))
                .setContentText(ctx.getString(R.string.notif_text))
                .setCategory(Notification.CATEGORY_ALARM)
                .setPriority(Notification.PRIORITY_MAX)
                .setOngoing(true)
                .setAutoCancel(true)
                .setContentIntent(content)
                .setFullScreenIntent(fsi, true);
        try {
            nm.notify(NOTIF_ID, b.build());
        } catch (SecurityException ignored) {
        }
    }

    /** 4:52 ص */
    public static String fmtTime(Calendar c) {
        int h = c.get(Calendar.HOUR_OF_DAY);
        int m = c.get(Calendar.MINUTE);
        String suffix = h < 12 ? "ص" : "م";
        int h12 = h % 12;
        if (h12 == 0) h12 = 12;
        return String.format(java.util.Locale.US, "%d:%02d %s", h12, m, suffix);
    }
}
