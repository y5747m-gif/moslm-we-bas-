package com.hatsally.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Calendar;

/**
 * اختبار محرك الجدولة الأصلي ⏰ (يعمل على JVM بدون جهاز)
 * ------------------------------------------------------------------
 * نفس حالات scripts/schedule-test.ts الخاصة بمحرك الويب، حتى يبقى
 * الحساب في الأندرويد مطابقاً للحساب في الواجهة:
 *   - الرنين عند الموعد أو بعده بمهلة 45 دقيقة (مرة واحدة في اليوم)
 *   - فلترة الأيام + انتهاء المدة المحدودة + تجاوز منتصف الليل
 *
 * التشغيل: cd android && ./gradlew testDebugUnitTest
 */
public class AlarmSchedulerTest {

    private static final int[] FRI = { 5 };
    private static final int[] SAT = { 6 };
    private static final int[] ALL = { 0, 1, 2, 3, 4, 5, 6 };

    private static long at(int y, int month, int d, int h, int mi, int s) {
        Calendar c = Calendar.getInstance();
        c.clear();
        c.set(y, month - 1, d, h, mi, s);
        return c.getTimeInMillis();
    }

    private static AlarmStore.Config cfg(String time, int[] days, long startMillis, int duration, String lastFired) {
        AlarmStore.Config c = new AlarmStore.Config();
        c.armed = true;
        c.time = time;
        c.days = days;
        c.startMillis = startMillis;
        c.durationDays = duration;
        c.lastFiredKey = lastFired;
        c.graceMinutes = 45;
        return c;
    }

    private static String stamp(long millis) {
        return AlarmScheduler.describeNext(millis);
    }

    @Test
    public void beforeTime_todayIsNext() {
        long now = at(2026, 9, 11, 4, 0, 0);
        assertEquals("2026-09-11 05:00", stamp(AlarmScheduler.computeNextFire(cfg("05:00", FRI, 0, -1, null), now)));
        assertTrue(AlarmScheduler.dueRingMillis(cfg("05:00", FRI, 0, -1, null), now) < 0);
    }

    @Test
    public void twoMinutesLate_rings() {
        long now = at(2026, 9, 11, 5, 2, 0);
        assertEquals("2026-09-11 05:00", stamp(AlarmScheduler.dueRingMillis(cfg("05:00", FRI, 0, -1, null), now)));
    }

    @Test
    public void atGraceLimit_rings() {
        long now = at(2026, 9, 11, 5, 45, 0);
        assertTrue(AlarmScheduler.dueRingMillis(cfg("05:00", FRI, 0, -1, null), now) > 0);
    }

    @Test
    public void afterGrace_missed() {
        long now = at(2026, 9, 11, 5, 46, 0);
        assertTrue(AlarmScheduler.dueRingMillis(cfg("05:00", FRI, 0, -1, null), now) < 0);
    }

    @Test
    public void secondIsNotRequired_rings() {
        long now = at(2026, 9, 11, 5, 0, 37);
        assertTrue(AlarmScheduler.dueRingMillis(cfg("05:00", FRI, 0, -1, null), now) > 0);
    }

    @Test
    public void dayFilter_nextMatchingDay() {
        long now = at(2026, 9, 11, 6, 0, 0);
        assertEquals("2026-09-18 05:00", stamp(AlarmScheduler.computeNextFire(cfg("05:00", FRI, 0, -1, null), now)));
        assertEquals("2026-09-12 05:00", stamp(AlarmScheduler.computeNextFire(cfg("05:00", SAT, 0, -1, null), now)));
    }

    @Test
    public void firedToday_noRepeat() {
        long now = at(2026, 9, 11, 5, 2, 0);
        AlarmStore.Config c = cfg("05:00", FRI, 0, -1, "2026-09-11");
        assertTrue(AlarmScheduler.dueRingMillis(c, now) < 0);
        assertEquals("2026-09-18 05:00", stamp(AlarmScheduler.computeNextFire(c, now)));
    }

    @Test
    public void limitedDuration_expires() {
        long now = at(2026, 9, 11, 4, 0, 0);
        assertTrue(AlarmScheduler.isExpired(cfg("05:00", ALL, at(2026, 9, 3, 5, 0, 0), 7, null), now));
        assertTrue(AlarmScheduler.isExpired(cfg("05:00", ALL, at(2026, 9, 10, 5, 0, 0), 1, null), now));
        assertEquals(-1L, AlarmScheduler.computeNextFire(cfg("05:00", ALL, at(2026, 9, 3, 5, 0, 0), 7, null), now));
    }

    @Test
    public void limitedDuration_stillActiveOnLastDay() {
        long now = at(2026, 9, 11, 4, 0, 0);
        AlarmStore.Config c = cfg("05:00", ALL, at(2026, 9, 11, 4, 30, 0), 1, null);
        assertFalse(AlarmScheduler.isExpired(c, now));
        assertEquals("2026-09-11 05:00", stamp(AlarmScheduler.computeNextFire(c, now)));

        AlarmStore.Config day6 = cfg("05:00", ALL, at(2026, 9, 5, 5, 0, 0), 7, null);
        assertFalse(AlarmScheduler.isExpired(day6, now));
    }

    @Test
    public void forever_neverExpires() {
        long now = at(2030, 1, 1, 4, 0, 0);
        assertFalse(AlarmScheduler.isExpired(cfg("05:00", ALL, now, AlarmStore.FOREVER, null), now));
    }

    @Test
    public void midnightCrossing() {
        long now = at(2026, 9, 11, 23, 59, 0);
        assertEquals("2026-09-12 00:05", stamp(AlarmScheduler.computeNextFire(cfg("00:05", ALL, 0, -1, null), now)));
    }

    @Test
    public void invalidConfig_noSchedule() {
        long now = at(2026, 9, 11, 4, 0, 0);
        assertEquals(-1L, AlarmScheduler.computeNextFire(cfg("xx", ALL, 0, -1, null), now));
        assertEquals(-1L, AlarmScheduler.computeNextFire(cfg("05:00", new int[0], 0, -1, null), now));
        assertEquals(-1L, AlarmScheduler.computeNextFire(cfg("24:00", ALL, 0, -1, null), now));
        assertEquals(-1L, AlarmScheduler.computeNextFire(cfg("05:75", ALL, 0, -1, null), now));
    }

    @Test
    public void disarmed_nothingHappens() {
        long now = at(2026, 9, 11, 4, 0, 0);
        AlarmStore.Config off = cfg("05:00", ALL, 0, -1, null);
        off.armed = false;
        assertEquals(-1L, AlarmScheduler.computeNextFire(off, now));
        assertTrue(AlarmScheduler.dueRingMillis(off, at(2026, 9, 11, 5, 2, 0)) < 0);
    }

    @Test
    public void timeParsing() {
        assertEquals(2, AlarmScheduler.parseTime("05:00").length);
        assertEquals(5, AlarmScheduler.parseTime("05:00")[0]);
        assertEquals(0, AlarmScheduler.parseTime("05:00")[1]);
        assertEquals(null, AlarmScheduler.parseTime("bad"));
        assertEquals(null, AlarmScheduler.parseTime(null));
        assertEquals(null, AlarmScheduler.parseTime("23:60"));
        assertEquals(23, AlarmScheduler.parseTime("23:59")[0]);
    }

    @Test
    public void dayKeyAndConversion() {
        assertEquals("2026-09-11", AlarmStore.dayKey(at(2026, 9, 11, 23, 59, 59)));
        assertEquals("2026-01-05", AlarmStore.dayKey(at(2026, 1, 5, 0, 0, 0)));
        assertEquals(5, AlarmStore.calendarDayToJs(Calendar.FRIDAY));
        assertEquals(0, AlarmStore.calendarDayToJs(Calendar.SUNDAY));
        assertEquals(6, AlarmStore.calendarDayToJs(Calendar.SATURDAY));
        assertTrue(AlarmStore.containsDay(new int[] { 1, 3, 5 }, 5));
        assertFalse(AlarmStore.containsDay(new int[] { 1, 3, 5 }, 4));
    }

    @Test
    public void daysSerializationRoundTrip() {
        assertEquals("0,1,2,3,4,5,6", AlarmStore.joinDays(null));
        assertEquals("1,3,5", AlarmStore.joinDays(new int[] { 1, 3, 5 }));
        assertEquals(3, AlarmStore.parseDays("1,3,5").length);
        assertEquals(7, AlarmStore.parseDays("").length);
        assertEquals(7, AlarmStore.parseDays(null).length);
        assertEquals(2, AlarmStore.parseDays("1,9,3").length); // 9 يوم غير صالح
    }
}
