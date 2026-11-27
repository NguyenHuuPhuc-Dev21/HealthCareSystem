import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '../../styles/tokens';
import {
  getAvailabilities,
  updateAvailabilities,
} from './availability.api';
import { WeekdayWindowsEditor } from './components/WeekdayWindowsEditor';
import { MonthCalendar } from './components/MonthCalendar';
import { TimeOffSheet } from './components/TimeOffSheet';
import {
  lockedWindows,
  newId,
  type ConfirmedBooking,
  type DateAvailability,
  type RecurringWindow,
  type TimeOffException,
} from '@healthcare-system/shared';

export const AvailabilityScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Availability state
  const [recurring, setRecurring] = useState<RecurringWindow[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffException[]>([]);
  const [dateAvailability, setDateAvailability] = useState<DateAvailability[]>([]);
  const [bookings, setBookings] = useState<ConfirmedBooking[]>([]);

  // Snapshot for dirty-checking
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');

  // Active section tab: 'WEEKLY' or 'TIMEOFF'
  const [activeTab, setActiveTab] = useState<'WEEKLY' | 'TIMEOFF'>('WEEKLY');

  // Time off modal sheet
  const [timeOffSheetVisible, setTimeOffSheetVisible] = useState(false);

  const fetchAvailabilities = useCallback(async () => {
    try {
      const res = await getAvailabilities();
      if (res.success && res.data) {
        setRecurring(res.data.recurring || []);
        setTimeOff(res.data.timeOff || []);
        setDateAvailability(res.data.dateAvailability || []);
        setBookings(res.data.bookings || []);

        const snapshot = JSON.stringify({
          recurring: res.data.recurring || [],
          timeOff: res.data.timeOff || [],
          dateAvailability: res.data.dateAvailability || [],
        });
        setInitialSnapshot(snapshot);
      } else {
        Alert.alert('Lỗi tải dữ liệu', res.error?.message || 'Không thể tải lịch rảnh từ máy chủ.');
      }
    } catch {
      Alert.alert('Lỗi kết nối', 'Không thể kết nối máy chủ để tải lịch rảnh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchAvailabilities();
  }, [fetchAvailabilities]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchAvailabilities();
  };

  // Compute locked windows
  const locked = useMemo(() => lockedWindows(recurring, bookings), [recurring, bookings]);

  // Dirty check: hasChanges
  const currentSnapshot = useMemo(
    () => JSON.stringify({ recurring, timeOff, dateAvailability }),
    [recurring, timeOff, dateAvailability]
  );
  const hasChanges = initialSnapshot !== '' && currentSnapshot !== initialSnapshot;

  // Intercept navigation before leave if unsaved
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: any) => {
      if (!hasChanges) {
        return;
      }
      e.preventDefault();
      Alert.alert(
        'Thay đổi chưa được lưu',
        'Bạn có thay đổi lịch rảnh chưa được lưu lại. Bạn có chắc chắn muốn rời khỏi màn hình này?',
        [
          { text: 'Ở lại', style: 'cancel' },
          {
            text: 'Rời đi',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });
    return unsub;
  }, [navigation, hasChanges]);

  // Handlers for WeekdayWindowsEditor
  const handleAddWindow = (dayOfWeek: number, startTime: string, endTime: string) => {
    const newWindow: RecurringWindow = {
      id: newId('window'),
      dayOfWeek,
      startTime,
      endTime,
    };
    setRecurring((prev) => [...prev, newWindow]);
  };

  const handleDeleteWindow = (id: string) => {
    setRecurring((prev) => prev.filter((w) => w.id !== id));
  };

  const handleCopyDayToOthers = (fromDayOfWeek: number, targetDays: number[]) => {
    const sourceWindows = recurring.filter((w) => w.dayOfWeek === fromDayOfWeek);
    setRecurring((prev) => {
      // Keep windows from days not in targetDays
      const unaffected = prev.filter((w) => !targetDays.includes(w.dayOfWeek));
      // Replicate sourceWindows into each targetDay with new IDs
      const replicated: RecurringWindow[] = [];
      for (const tDay of targetDays) {
        for (const s of sourceWindows) {
          replicated.push({
            id: newId(`window-copy-d${tDay}`),
            dayOfWeek: tDay,
            startTime: s.startTime,
            endTime: s.endTime,
          });
        }
      }
      return [...unaffected, ...replicated];
    });

    Alert.alert(
      'Sao chép thành công',
      `Đã sao chép toàn bộ ${sourceWindows.length} khung giờ sang ${targetDays.length} ngày đã chọn.`
    );
  };

  // Handlers for TimeOff
  const handleAddTimeOff = (newExceptions: TimeOffException[]) => {
    setTimeOff((prev) => {
      const existingDates = new Set(prev.map((t) => t.specificDate));
      const filtered = newExceptions.filter((e) => !existingDates.has(e.specificDate));
      return [...prev, ...filtered];
    });
  };

  const handleRemoveTimeOff = (id: string) => {
    setTimeOff((prev) => prev.filter((t) => t.id !== id));
  };

  // Save full schedule overwrite
  const handleSaveSchedule = async () => {
    if (!hasChanges || saving) return;
    setSaving(true);

    try {
      const res = await updateAvailabilities({
        recurring,
        timeOff,
        dateAvailability,
      });

      if (res.success && res.data) {
        setRecurring(res.data.recurring || []);
        setTimeOff(res.data.timeOff || []);
        setDateAvailability(res.data.dateAvailability || []);
        setBookings(res.data.bookings || []);

        const snapshot = JSON.stringify({
          recurring: res.data.recurring || [],
          timeOff: res.data.timeOff || [],
          dateAvailability: res.data.dateAvailability || [],
        });
        setInitialSnapshot(snapshot);

        Alert.alert('Thành công', 'Lịch rảnh và ngày nghỉ của bạn đã được cập nhật thành công.');
      } else {
        if (res.error?.code === 'AVAILABILITY_LOCKED') {
          Alert.alert('Lỗi khóa khung giờ', res.error.message);
        } else {
          Alert.alert('Không thể lưu lịch', res.error?.message || 'Có lỗi xảy ra khi lưu lịch rảnh.');
        }
      }
    } catch {
      Alert.alert('Lỗi kết nối', 'Không thể gửi cập nhật lịch rảnh lên máy chủ.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={tokens.colors.brandJade} />
        <Text style={styles.loadingText}>Đang tải lịch rảnh & ngày nghỉ...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 44,
              height: 44,
              marginLeft: -8,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
            }}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <ArrowLeft size={22} color={tokens.colors.inkPrimary} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Lịch rảnh & Ngày nghỉ</Text>
        </View>
        <Text style={styles.screenSubtitle}>
          Thiết lập khung giờ rảnh cố định theo tuần và đăng ký các ngày nghỉ cụ thể (FR-SCHED-01).
        </Text>

        {/* 2-Section Tabs */}
        <View style={styles.segmentedTabs} accessibilityRole="tablist">
          <TouchableOpacity
            style={[styles.segTab, activeTab === 'WEEKLY' && styles.segTabActive]}
            onPress={() => setActiveTab('WEEKLY')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'WEEKLY' }}
          >
            <Text style={[styles.segTabText, activeTab === 'WEEKLY' && styles.segTabTextActive]}>
              Khung giờ rảnh theo tuần
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segTab, activeTab === 'TIMEOFF' && styles.segTabActive]}
            onPress={() => setActiveTab('TIMEOFF')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'TIMEOFF' }}
          >
            <Text style={[styles.segTabText, activeTab === 'TIMEOFF' && styles.segTabTextActive]}>
              Lịch tháng & Ngày nghỉ
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'WEEKLY' ? (
          <WeekdayWindowsEditor
            recurring={recurring}
            locked={locked}
            onAddWindow={handleAddWindow}
            onDeleteWindow={handleDeleteWindow}
            onCopyDayToOthers={handleCopyDayToOthers}
          />
        ) : (
          <View>
            <Text style={styles.monthSectionTitle}>Tổng quan lịch tháng & Ca đã nhận</Text>
            <Text style={styles.monthSectionDesc}>
              Xem ca trực đã chốt (dấu chấm xanh) và ngày nghỉ phép (tô xám). Bấm "+ Đăng ký nghỉ" để thêm ngày nghỉ.
            </Text>
            <MonthCalendar
              timeOff={timeOff}
              bookings={bookings}
              onOpenTimeOffSheet={() => setTimeOffSheetVisible(true)}
            />
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Save Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomInfoTitle}>
            {hasChanges ? 'Có thay đổi chưa lưu' : 'Lịch đã đồng bộ'}
          </Text>
          <Text style={styles.bottomInfoSub}>
            {hasChanges
              ? 'Bấm nút bên dưới để ghi đè lịch lên hệ thống'
              : 'Toàn bộ khung giờ đã được lưu'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (!hasChanges || saving) && styles.saveBtnDisabled]}
          disabled={!hasChanges || saving}
          onPress={handleSaveSchedule}
          accessibilityRole="button"
          accessibilityLabel="Lưu lịch rảnh và ngày nghỉ"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Lưu lịch</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Time Off Modal Sheet */}
      <TimeOffSheet
        visible={timeOffSheetVisible}
        timeOffList={timeOff}
        onAddTimeOff={handleAddTimeOff}
        onRemoveTimeOff={handleRemoveTimeOff}
        onClose={() => setTimeOffSheetVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: tokens.colors.canvas,
  },
  loadingText: {
    fontSize: 15,
    color: tokens.colors.inkSecondary,
    marginTop: 12,
  },
  topHeader: {
    backgroundColor: tokens.colors.paper,
    paddingTop: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  segmentedTabs: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.subtle,
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  segTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  segTabActive: {
    backgroundColor: tokens.colors.paper,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  segTabText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  segTabTextActive: {
    color: tokens.colors.brandJade,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  monthSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 4,
  },
  monthSectionDesc: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  bottomBar: {
    backgroundColor: tokens.colors.paper,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bottomInfo: {
    flex: 1,
  },
  bottomInfoTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  bottomInfoSub: {
    fontSize: 12.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: tokens.colors.brandJade,
    paddingHorizontal: 22,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
