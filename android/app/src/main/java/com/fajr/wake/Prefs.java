package com.fajr.wake;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.TimeZone;

/** الإعدادات المخزنة محليًا + قوائم المدن وطرق الحساب */
public final class Prefs {
    private static final String FILE = "fajr_prefs";

    // {الاسم، خط العرض، خط الطول، المنطقة الزمنية IANA}
    public static final String[][] CITIES = {
            {"مكة المكرمة", "21.3891", "39.8579", "Asia/Riyadh"},
            {"المدينة المنورة", "24.5247", "39.5692", "Asia/Riyadh"},
            {"الرياض", "24.7136", "46.6753", "Asia/Riyadh"},
            {"جدة", "21.4858", "39.1925", "Asia/Riyadh"},
            {"الدمام", "26.4207", "50.0888", "Asia/Riyadh"},
            {"أبها", "18.2465", "42.5117", "Asia/Riyadh"},
            {"تبوك", "28.3838", "36.5662", "Asia/Riyadh"},
            {"القدس", "31.7683", "35.2137", "Asia/Jerusalem"},
            {"غزة", "31.5017", "34.4668", "Asia/Gaza"},
            {"رام الله", "31.9038", "35.2034", "Asia/Jerusalem"},
            {"عمّان", "31.9454", "35.9284", "Asia/Amman"},
            {"دمشق", "33.5138", "36.2765", "Asia/Damascus"},
            {"حلب", "36.2021", "37.1343", "Asia/Damascus"},
            {"بيروت", "33.8938", "35.5018", "Asia/Beirut"},
            {"بغداد", "33.3152", "44.3661", "Asia/Baghdad"},
            {"البصرة", "30.5081", "47.7835", "Asia/Baghdad"},
            {"أربيل", "36.1901", "44.0091", "Asia/Baghdad"},
            {"الموصل", "36.3350", "43.1189", "Asia/Baghdad"},
            {"الكويت", "29.3759", "47.9774", "Asia/Kuwait"},
            {"الدوحة", "25.2854", "51.5310", "Asia/Qatar"},
            {"المنامة", "26.2285", "50.5860", "Asia/Bahrain"},
            {"مسقط", "23.5880", "58.3829", "Asia/Muscat"},
            {"دبي", "25.2048", "55.2708", "Asia/Dubai"},
            {"أبو ظبي", "24.4539", "54.3773", "Asia/Dubai"},
            {"الشارقة", "25.3463", "55.4209", "Asia/Dubai"},
            {"صنعاء", "15.3694", "44.1910", "Asia/Aden"},
            {"عدن", "12.7794", "45.0367", "Asia/Aden"},
            {"القاهرة", "30.0444", "31.2357", "Africa/Cairo"},
            {"الإسكندرية", "31.2001", "29.9187", "Africa/Cairo"},
            {"الخرطوم", "15.5007", "32.5599", "Africa/Khartoum"},
            {"طرابلس", "32.8872", "13.1913", "Africa/Tripoli"},
            {"تونس", "36.8065", "10.1815", "Africa/Tunis"},
            {"الجزائر", "36.7538", "3.0588", "Africa/Algiers"},
            {"الرباط", "34.0209", "-6.8416", "Africa/Casablanca"},
            {"الدار البيضاء", "33.5731", "-7.5898", "Africa/Casablanca"},
            {"نواكشوط", "18.0735", "-15.9582", "Africa/Nouakchott"},
            {"إسطنبول", "41.0082", "28.9784", "Europe/Istanbul"},
            {"لندن", "51.5074", "-0.1278", "Europe/London"},
            {"باريس", "48.8566", "2.3522", "Europe/Paris"},
            {"برلين", "52.5200", "13.4050", "Europe/Berlin"},
    };

    // {الاسم، زاوية الفجر}
    public static final String[][] METHODS = {
            {"أم القرى (مكة)", "18.5"},
            {"رابطة العالم الإسلامي", "18"},
            {"الهيئة المصرية العامة للمساحة", "19.5"},
            {"أمريكا الشمالية ISNA", "15"},
            {"جامعة كراتشي", "18"},
    };

    private final SharedPreferences sp;

    private Prefs(Context c) {
        sp = c.getApplicationContext().getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    private static Prefs instance;

    public static Prefs get(Context c) {
        synchronized (Prefs.class) {
            if (instance == null) instance = new Prefs(c);
            return instance;
        }
    }

    public boolean enabled() { return sp.getBoolean("enabled", false); }
    public void setEnabled(boolean v) { sp.edit().putBoolean("enabled", v).apply(); }

    /** -1 = موقع GPS مخصص، وإلا فهرس CITIES */
    public int cityIndex() { return sp.getInt("city", 0); }
    public void setCity(int i) { sp.edit().putInt("city", i).apply(); }

    public double lat() {
        if (cityIndex() < 0) return Double.longBitsToDouble(sp.getLong("gps_lat", 0));
        return Double.parseDouble(CITIES[cityIndex()][1]);
    }

    public double lng() {
        if (cityIndex() < 0) return Double.longBitsToDouble(sp.getLong("gps_lng", 0));
        return Double.parseDouble(CITIES[cityIndex()][2]);
    }

    public TimeZone zone() {
        String id = cityIndex() < 0 ? TimeZone.getDefault().getID() : CITIES[cityIndex()][3];
        return TimeZone.getTimeZone(id);
    }

    public String cityName(Context c) {
        int i = cityIndex();
        if (i < 0) return sp.getString("gps_name", c.getString(R.string.perm_loc_title));
        return CITIES[i][0];
    }

    public void setGpsLocation(double lat, double lng) {
        sp.edit().putInt("city", -1)
                .putLong("gps_lat", Double.doubleToRawLongBits(lat))
                .putLong("gps_lng", Double.doubleToRawLongBits(lng))
                .putString("gps_name", null).apply();
    }

    public void setGpsName(String name) {
        sp.edit().putString("gps_name", name).apply();
    }

    public int methodIndex() { return sp.getInt("method", 0); }
    public void setMethod(int i) { sp.edit().putInt("method", i).apply(); }
    public double angle() { return Double.parseDouble(METHODS[methodIndex()][1]); }

    public int minutesBefore() { return sp.getInt("minutes_before", 0); }
    public void setMinutesBefore(int v) { sp.edit().putInt("minutes_before", v).apply(); }

    public boolean backupEnabled() { return sp.getBoolean("backup", true); }
    public void setBackupEnabled(boolean v) { sp.edit().putBoolean("backup", v).apply(); }

    /** فارغ = النغمة الافتراضية، "none" = اهتزاز فقط، وإلا content:// */
    public String soundUri() { return sp.getString("sound", ""); }
    public void setSoundUri(String v) { sp.edit().putString("sound", v).apply(); }

    /** اسم الملف المعروض في الإعدادات */
    public String soundName() { return sp.getString("sound_name", null); }
    public void setSoundName(String v) { sp.edit().putString("sound_name", v).apply(); }

    public int snoozeCount() { return sp.getInt("snooze_count", 0); }
    public void setSnoozeCount(int v) { sp.edit().putInt("snooze_count", v).apply(); }

    public int wakeTotal() { return sp.getInt("wake_total", 0); }
    public void incWakeTotal() { sp.edit().putInt("wake_total", wakeTotal() + 1).apply(); }
}
