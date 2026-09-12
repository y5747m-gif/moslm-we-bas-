package com.fajr.wake;

import java.util.Calendar;

/**
 * حساب وقت الفجر فلكيًا محليًا (بدون إنترنت).
 * خوارزمية مطابقة لمكتبة PrayTimes المعتمدة عالميًا،
 * مع خطة بديلة لصيف خطوط العرض العالية (سُدس الليل) حين تعذّر بلوغ الزاوية.
 */
public final class PrayerTimes {
    private PrayerTimes() {}

    /** زوايا الفجر للطرق المعتمدة */
    public static final double ANGLE_UMM_ALQURA = 18.5; // أم القرى
    public static final double ANGLE_MWL = 18.0;        // رابطة العالم الإسلامي
    public static final double ANGLE_EGYPT = 19.5;      // الهيئة المصرية العامة للمساحة
    public static final double ANGLE_ISNA = 15.0;       // أمريكا الشمالية
    public static final double ANGLE_KARACHI = 18.0;    // جامعة العلوم الإسلامية بكراتشي

    /**
     * دقائق الفجر من بداية اليوم المحلي، أو -1 إذا تعذر الحساب (مناطق قطبية).
     */
    public static double fajrMinutes(int y, int m, int d, double lat, double lng,
                                     double tzHours, double fajrAngle) {
        double jd = julian(y, m, d) - lng / (15.0 * 24.0);

        // 1) المحاولة الأساسية: الزاوية الفعلية للطريقة المختارة
        double[] dn = sunPosition(jd + 5.0 / 24.0); // [الميل, معادلة الوقت] عند الفجر التقريبي
        double noon = 12.0 - dn[1];
        double cosH = cosForAltitude(dn[0], lat, fajrAngle);
        if (cosH >= -1.0 && cosH <= 1.0) {
            double h = deg(Math.acos(cosH)) / 15.0; // ساعات قبل الظهر
            // civil = (الظهر - h) - lng/15 + tz
            return fix((noon - h - lng / 15.0 + tzHours) * 60.0, 1440.0);
        }

        // 2) خطة سُدس الليل (لصيف خطوط العرض العالية حيث لا تبلغ الشمس الزاوية):
        //    الفجر = منتصف الليل + سُدس الليل
        double[] dset = sunPosition(jd + 18.0 / 24.0);
        double noonS = 12.0 - dset[1];
        double cosS = cosForAltitude(dset[0], lat, -0.833); // الغروب (انكسار + قطر القرص)
        if (cosS < -1.0 || cosS > 1.0) return -1;
        double hs = deg(Math.acos(cosS)) / 15.0;
        double sunsetC = (noonS + hs - lng / 15.0 + tzHours) * 60.0;

        double[] drise = sunPosition(jd + 1 + 6.0 / 24.0); // شروق اليوم التالي
        double noonR = 12.0 - drise[1];
        double cosR = cosForAltitude(drise[0], lat, -0.833);
        if (cosR < -1.0 || cosR > 1.0) return -1;
        double hr = deg(Math.acos(cosR)) / 15.0;
        double sunriseC = (noonR - hr - lng / 15.0 + tzHours) * 60.0 + 1440.0;

        double night = sunriseC - sunsetC;
        if (night <= 0) return -1;
        return fix(sunsetC + night * 9.0 / 14.0, 1440.0); // نصف الليل + سُدسه
    }

    /** cos(الزاوية الساعية) لبلوغ ارتفاع الشمس -angle */
    private static double cosForAltitude(double decl, double lat, double angle) {
        return (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat)))
                / (Math.cos(rad(decl)) * Math.cos(rad(lat)));
    }

    /**
     * موعد الفجر كتقويم ليوم معين. يعيد null إذا تعذر الحساب.
     */
    public static Calendar fajrOn(Calendar day, double lat, double lng, double tzHours, double angle) {
        double mins = fajrMinutes(
                day.get(Calendar.YEAR), day.get(Calendar.MONTH) + 1, day.get(Calendar.DAY_OF_MONTH),
                lat, lng, tzHours, angle);
        if (mins < 0) return null;
        int hh = (int) (mins / 60);
        int mm = (int) Math.round(mins - hh * 60);
        if (mm == 60) { mm = 0; hh += 1; }
        Calendar out = (Calendar) day.clone();
        out.set(Calendar.HOUR_OF_DAY, hh);
        out.set(Calendar.MINUTE, mm);
        out.set(Calendar.SECOND, 0);
        out.set(Calendar.MILLISECOND, 0);
        return out;
    }

    static double rad(double d) { return d * Math.PI / 180.0; }
    static double deg(double r) { return r * 180.0 / Math.PI; }
    static double fix(double a, double b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; }

    static double julian(int y, int m, int d) {
        if (m <= 2) { y -= 1; m += 12; }
        double a = Math.floor(y / 100.0);
        double b = 2.0 - a + Math.floor(a / 4.0);
        return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
    }

    /** [الميل, معادلة الوقت بالساعات] */
    static double[] sunPosition(double jd) {
        double d = jd - 2451545.0;
        double g = fix(357.529 + 0.98560028 * d, 360.0);
        double q = fix(280.459 + 0.98564736 * d, 360.0);
        double l = fix(q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g)), 360.0);
        double e = 23.439 - 0.00000036 * d;
        double ra = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(l)), Math.cos(rad(l)))) / 15.0, 24.0);
        double eqt = q / 15.0 - ra;
        double decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(l))));
        return new double[]{decl, eqt};
    }
}
