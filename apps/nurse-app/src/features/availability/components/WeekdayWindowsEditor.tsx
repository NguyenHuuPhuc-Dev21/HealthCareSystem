import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { tokens } from '../../../styles/tokens';
import {
  WEEKDAY_ORDER,
  formatWindow,
  isOvernight,
  type RecurringWindow,
} from '@healthcare-system/shared';
import { TimeRangeSheet } from './TimeRangeSheet';

export interface WeekdayWindowsEditorProps {
  recurring: RecurringWindow[];
  locked: Map<string, string>;
  onAddWindow: (dayOfWeek: number, startTime: string, endTime: string) => void;
  onDeleteWindow: (id: string) => void;
  onCopyDayToOthers: (fromDayOfWeek: number, targetDays: number[]) => void;
}

export const WeekdayWindowsEditor: React.FC<WeekdayWindowsEditorProps> = ({
  recurring,
  locked,
  onAddWindow,
  onDeleteWindow,
  onCopyDayToOthers,
}) => {
  // State for TimeRangeSheet
  const [addingDay, setAddingDay] = useState<{ dayOfWeek: number; label: string } | null>(null);

  // State for Copy Modal
  const [copyingFromDay, setCopyingFromDay] = useState<{ dayOfWeek: number; label: string } | null>(
    null
  );
  const [selectedTargetDays, setSelectedTargetDays] = useState<number[]>([]);

  const handleOpenAddSheet = (dayOfWeek: number, label: string) => {
    setAddingDay({ dayOfWeek, label });
  };

  const handleOpenCopyModal = (dayOfWeek: number, label: string) => {
    setCopyingFromDay({ dayOfWeek, label });
    // Default: select all other weekdays except source day
    setSelectedTargetDays(
      WEEKDAY_ORDER.filter((d) => d.dayOfWeek !== dayOfWeek).map((d) => d.dayOfWeek)
    );
  };

  const handleToggleTargetDay = (day: number) => {
    setSelectedTargetDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleConfirmCopy = () => {
    if (!copyingFromDay || selectedTargetDays.length === 0) return;
    onCopyDayToOthers(copyingFromDay.dayOfWeek, selectedTargetDays);
    setCopyingFromDay(null);
  };

  const handleDeletePress = (window: RecurringWindow) => {
    const bookingCode = locked.get(window.id);
    if (bookingCode) {
      Alert.alert(
        'Không thể xóa khung giờ',
        `Khung giờ này đang có ca trực ${bookingCode} đã nhận. Bạn không thể xóa hoặc sửa khung giờ này.`
      );
      return;
    }

    Alert.alert(
      'Xóa khung giờ',
      `Bạn có chắc chắn muốn xóa khung giờ ${formatWindow(window)}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => onDeleteWindow(window.id),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>Khung giờ rảnh hằng tuần</Text>
      <Text style={styles.sectionDesc}>
        Hệ thống sẽ tự động ghép bạn vào các ca trực thuộc khung giờ này. Khung giờ nào có ca đã nhận sẽ tự động khóa không thể xóa.
      </Text>

      {WEEKDAY_ORDER.map(({ dayOfWeek, label }) => {
        const dayWindows = recurring.filter((w) => w.dayOfWeek === dayOfWeek);

        return (
          <View key={`day-${dayOfWeek}`} style={styles.dayCard}>
            {/* Day Header */}
            <View style={styles.dayHeader}>
              <View style={styles.dayTitleWrap}>
                <Text style={styles.dayLabel}>{label}</Text>
                <Text style={styles.windowCount}>
                  {dayWindows.length === 0 ? 'Chưa cài đặt (Nghỉ)' : `${dayWindows.length} khung giờ`}
                </Text>
              </View>

              <View style={styles.headerBtnGroup}>
                {dayWindows.length > 0 && (
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => handleOpenCopyModal(dayOfWeek, label)}
                    accessibilityRole="button"
                    accessibilityLabel={`Sao chép lịch ${label} sang các ngày khác`}
                  >
                    <Text style={styles.copyBtnText}>Sao chép</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => handleOpenAddSheet(dayOfWeek, label)}
                  accessibilityRole="button"
                  accessibilityLabel={`Thêm khung giờ cho ${label}`}
                >
                  <Text style={styles.addBtnText}>+ Thêm giờ</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* List of windows */}
            {dayWindows.length === 0 ? (
              <View style={styles.emptyDayBox}>
                <Text style={styles.emptyDayText}>Chưa có khung giờ rảnh vào ngày này.</Text>
              </View>
            ) : (
              <View style={styles.windowsList}>
                {dayWindows.map((w) => {
                  const bookingCode = locked.get(w.id);
                  const isLocked = Boolean(bookingCode);
                  const overnight = isOvernight(w);

                  return (
                    <View
                      key={w.id}
                      style={[styles.windowRow, isLocked && styles.windowRowLocked]}
                    >
                      <View style={styles.windowInfo}>
                        <Text style={styles.windowTimeText}>{formatWindow(w)}</Text>
                        <View style={styles.badgesRow}>
                          {overnight && (
                            <View style={styles.overnightBadge}>
                              <Text style={styles.overnightBadgeText}>Qua đêm</Text>
                            </View>
                          )}
                          {isLocked && (
                            <View style={styles.lockedBadge}>
                              <Text style={styles.lockedBadgeText}>
                                🔒 Có ca {bookingCode}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.deleteBtn, isLocked && styles.deleteBtnDisabled]}
                        onPress={() => handleDeletePress(w)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isLocked
                            ? `Khóa xóa khung giờ có ca ${bookingCode}`
                            : `Xóa khung giờ ${formatWindow(w)}`
                        }
                      >
                        <Text style={[styles.deleteBtnText, isLocked && styles.deleteBtnTextDisabled]}>
                          {isLocked ? 'Khóa' : 'Xóa'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {/* Time Range Sheet Modal */}
      {addingDay && (
        <TimeRangeSheet
          visible={Boolean(addingDay)}
          dayOfWeek={addingDay.dayOfWeek}
          dayLabel={addingDay.label}
          existingWindows={recurring.filter((w) => w.dayOfWeek === addingDay.dayOfWeek)}
          onSave={(s, e) => onAddWindow(addingDay.dayOfWeek, s, e)}
          onClose={() => setAddingDay(null)}
        />
      )}

      {/* Copy Schedule to Other Days Modal */}
      <Modal
        visible={Boolean(copyingFromDay)}
        transparent
        animationType="fade"
        onRequestClose={() => setCopyingFromDay(null)}
      >
        <View style={styles.copyModalBackdrop}>
          <View style={styles.copyModalContainer}>
            <Text style={styles.copyModalTitle}>
              Sao chép lịch từ {copyingFromDay?.label}
            </Text>
            <Text style={styles.copyModalDesc}>
              Chọn các ngày bạn muốn áp dụng toàn bộ khung giờ của {copyingFromDay?.label}:
            </Text>

            <View style={styles.targetDaysGrid}>
              {WEEKDAY_ORDER.filter((d) => d.dayOfWeek !== copyingFromDay?.dayOfWeek).map((d) => {
                const selected = selectedTargetDays.includes(d.dayOfWeek);
                return (
                  <TouchableOpacity
                    key={`target-${d.dayOfWeek}`}
                    style={[styles.targetDayChip, selected && styles.targetDayChipSelected]}
                    onPress={() => handleToggleTargetDay(d.dayOfWeek)}
                  >
                    <Text
                      style={[
                        styles.targetDayChipText,
                        selected && styles.targetDayChipTextSelected,
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.copyModalActions}>
              <TouchableOpacity
                style={styles.copyCancelBtn}
                onPress={() => setCopyingFromDay(null)}
              >
                <Text style={styles.copyCancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.copyConfirmBtn,
                  selectedTargetDays.length === 0 && styles.copyConfirmBtnDisabled,
                ]}
                disabled={selectedTargetDays.length === 0}
                onPress={handleConfirmCopy}
              >
                <Text style={styles.copyConfirmBtnText}>
                  Sao chép ({selectedTargetDays.length} ngày)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  dayCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.subtle,
  },
  dayTitleWrap: {
    flex: 1,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  windowCount: {
    fontSize: 12.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  headerBtnGroup: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  copyBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: tokens.colors.subtle,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  addBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  emptyDayBox: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyDayText: {
    fontSize: 13.5,
    color: tokens.colors.inkMuted,
    fontStyle: 'italic',
  },
  windowsList: {
    marginTop: 8,
    gap: 8,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: tokens.colors.canvas,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  windowRowLocked: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  windowInfo: {
    flex: 1,
  },
  windowTimeText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  overnightBadge: {
    backgroundColor: tokens.colors.accentOchreSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overnightBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.accentOchre,
  },
  lockedBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  lockedBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  deleteBtnDisabled: {
    backgroundColor: tokens.colors.subtle,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.alertCrimson,
  },
  deleteBtnTextDisabled: {
    color: tokens.colors.inkMuted,
  },
  copyModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  copyModalContainer: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  copyModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  copyModalDesc: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginBottom: 16,
    lineHeight: 19,
  },
  targetDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  targetDayChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    backgroundColor: tokens.colors.subtle,
  },
  targetDayChipSelected: {
    backgroundColor: tokens.colors.brandJadeSoft,
    borderColor: tokens.colors.brandJade,
  },
  targetDayChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
  },
  targetDayChipTextSelected: {
    color: tokens.colors.brandJade,
    fontWeight: '700',
  },
  copyModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  copyCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  copyConfirmBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 10,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyConfirmBtnDisabled: {
    opacity: 0.45,
  },
  copyConfirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
