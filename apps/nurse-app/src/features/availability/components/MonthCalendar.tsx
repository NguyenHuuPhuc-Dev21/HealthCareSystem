import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { tokens } from '../../../styles/tokens';
import type { ConfirmedBooking, TimeOffException } from '@healthcare-system/shared';

export interface MonthCalendarProps {
  timeOff: TimeOffException[];
  bookings: ConfirmedBooking[];
  onSelectDate?: (dateStr: string) => void;
  onOpenTimeOffSheet: () => void;
}

const WEEKDAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  timeOff,
  bookings,
  onSelectDate,
  onOpenTimeOffSheet,
}) => {
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth()); // 0-indexed

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Build calendar matrix (7 columns)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    // getDay() gives 0 for Sunday, 1 for Monday... We want 0 for Monday.. 6 for Sunday
    const startDayIndex = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const cells: Array<{
      key: string;
      dayNumber: number | null;
      dateStr: string | null;
      isToday: boolean;
      isTimeOff: boolean;
      hasBookings: boolean;
      bookingCodes: string[];
    }> = [];

    // Leading blanks
    for (let i = 0; i < startDayIndex; i++) {
      cells.push({
        key: `blank-${i}`,
        dayNumber: null,
        dateStr: null,
        isToday: false,
        isTimeOff: false,
        hasBookings: false,
        bookingCodes: [],
      });
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(currentMonth + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateStr = `${currentYear}-${mStr}-${dStr}`;

      const isOff = timeOff.some((t) => t.specificDate === dateStr);
      const dayBookings = bookings.filter((b) => b.date === dateStr);

      cells.push({
        key: `day-${dateStr}`,
        dayNumber: day,
        dateStr,
        isToday: dateStr === todayStr,
        isTimeOff: isOff,
        hasBookings: dayBookings.length > 0,
        bookingCodes: dayBookings.map((b) => b.code),
      });
    }

    return cells;
  }, [currentYear, currentMonth, timeOff, bookings, todayStr]);

  return (
    <View style={styles.container}>
      {/* Month Navigation & Register Time-Off */}
      <View style={styles.header}>
        <View style={styles.monthNav}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={handlePrevMonth}
            accessibilityRole="button"
            accessibilityLabel="Tháng trước"
          >
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            Tháng {currentMonth + 1}/{currentYear}
          </Text>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={handleNextMonth}
            accessibilityRole="button"
            accessibilityLabel="Tháng sau"
          >
            <Text style={styles.navBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.timeOffActionBtn}
          onPress={onOpenTimeOffSheet}
          accessibilityRole="button"
          accessibilityLabel="Đăng ký ngày nghỉ"
        >
          <Text style={styles.timeOffActionText}>+ Đăng ký nghỉ</Text>
        </TouchableOpacity>
      </View>

      {/* Weekday Labels Header */}
      <View style={styles.weekdaysRow}>
        {WEEKDAY_HEADERS.map((w) => (
          <View key={w} style={styles.weekdayCol}>
            <Text style={styles.weekdayText}>{w}</Text>
          </View>
        ))}
      </View>

      {/* 7-Column Days Grid */}
      <View style={styles.grid}>
        {calendarDays.map((cell) => {
          if (cell.dayNumber === null) {
            return <View key={cell.key} style={styles.dayCellBlank} />;
          }

          return (
            <TouchableOpacity
              key={cell.key}
              style={[
                styles.dayCell,
                cell.isTimeOff && styles.dayCellTimeOff,
                cell.isToday && styles.dayCellToday,
              ]}
              disabled={!onSelectDate}
              onPress={() => cell.dateStr && onSelectDate?.(cell.dateStr)}
            >
              <Text
                style={[
                  styles.dayNumberText,
                  cell.isTimeOff && styles.dayNumberTimeOff,
                  cell.isToday && styles.dayNumberToday,
                ]}
              >
                {cell.dayNumber}
              </Text>

              {cell.isTimeOff && (
                <View style={styles.timeOffBadge}>
                  <Text style={styles.timeOffBadgeText}>Nghỉ</Text>
                </View>
              )}

              {cell.hasBookings && (
                <View style={styles.dotRow}>
                  <View style={styles.bookingDot} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={styles.legendDotBooking} />
          <Text style={styles.legendText}>Có ca đã nhận</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendBoxTimeOff} />
          <Text style={styles.legendText}>Ngày đăng ký nghỉ</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendBoxToday} />
          <Text style={styles.legendText}>Hôm nay</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: tokens.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    lineHeight: 22,
  },
  monthTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  timeOffActionBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: tokens.colors.accentOchreSoft,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  timeOffActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.accentOchre,
  },
  weekdaysRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.subtle,
    paddingBottom: 8,
    marginBottom: 8,
  },
  weekdayCol: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellBlank: {
    width: '14.28%',
    aspectRatio: 1,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    position: 'relative',
  },
  dayCellTimeOff: {
    backgroundColor: '#E2E8F0', // Shaded gray as required by N13
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
  },
  dayNumberText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
  },
  dayNumberTimeOff: {
    color: '#64748B',
  },
  dayNumberToday: {
    color: tokens.colors.brandJade,
    fontWeight: '800',
  },
  timeOffBadge: {
    marginTop: 1,
  },
  timeOffBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  dotRow: {
    position: 'absolute',
    bottom: 3,
  },
  bookingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.colors.brandJade,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.subtle,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDotBooking: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.brandJade,
  },
  legendBoxTimeOff: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  legendBoxToday: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
  },
  legendText: {
    fontSize: 12.5,
    color: tokens.colors.inkSecondary,
  },
});
