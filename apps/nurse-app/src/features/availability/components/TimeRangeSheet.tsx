import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { tokens } from '../../../styles/tokens';
import {
  findOverlap,
  isOvernight,
  formatWindow,
  type RecurringWindow,
} from '@healthcare-system/shared';

export interface TimeRangeSheetProps {
  visible: boolean;
  dayOfWeek: number;
  dayLabel: string;
  existingWindows: RecurringWindow[];
  initialStartTime?: string;
  initialEndTime?: string;
  editingWindowId?: string;
  onSave: (startTime: string, endTime: string) => void;
  onClose: () => void;
}

const TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, '0');
  TIME_SLOTS.push(`${hh}:00`);
  TIME_SLOTS.push(`${hh}:30`);
}
TIME_SLOTS.push('23:59');

const PRESETS = [
  { label: 'Sáng (07:00 – 12:00)', s: '07:00', e: '12:00' },
  { label: 'Chiều (13:00 – 17:00)', s: '13:00', e: '17:00' },
  { label: 'Tối (18:00 – 22:00)', s: '18:00', e: '22:00' },
  { label: 'Qua đêm (19:00 – 06:00)', s: '19:00', e: '06:00' },
  { label: 'Cả ngày (00:00 – 23:59)', s: '00:00', e: '23:59' },
];

export const TimeRangeSheet: React.FC<TimeRangeSheetProps> = ({
  visible,
  dayOfWeek,
  dayLabel,
  existingWindows,
  initialStartTime = '07:00',
  initialEndTime = '12:00',
  editingWindowId,
  onSave,
  onClose,
}) => {
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);

  useEffect(() => {
    if (visible) {
      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
    }
  }, [visible, initialStartTime, initialEndTime]);

  const overnight = useMemo(() => isOvernight({ startTime, endTime }), [startTime, endTime]);

  // Check overlap with existing windows (excluding the one being edited)
  const overlap = useMemo(() => {
    const others = editingWindowId
      ? existingWindows.filter((w) => w.id !== editingWindowId)
      : existingWindows;
    return findOverlap(others, dayOfWeek, { startTime, endTime });
  }, [existingWindows, editingWindowId, dayOfWeek, startTime, endTime]);

  const canSave = !overlap && startTime !== endTime;

  const handleSave = () => {
    if (!canSave) return;
    onSave(startTime, endTime);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.sheetTitle}>
                {editingWindowId ? 'Chỉnh sửa khung giờ' : 'Thêm khung giờ rảnh'}
              </Text>
              <Text style={styles.sheetSubtitle}>{dayLabel}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={tokens.colors.inkSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            {/* Quick Presets */}
            <Text style={styles.sectionTitle}>Mẫu giờ phổ biến</Text>
            <View style={styles.presetsWrap}>
              {PRESETS.map((p) => {
                const active = startTime === p.s && endTime === p.e;
                return (
                  <TouchableOpacity
                    key={p.label}
                    style={[styles.presetChip, active && styles.presetChipActive]}
                    onPress={() => {
                      setStartTime(p.s);
                      setEndTime(p.e);
                    }}
                  >
                    <Text
                      style={[styles.presetChipText, active && styles.presetChipTextActive]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Time Pickers (Start & End) */}
            <View style={styles.pickersRow}>
              {/* Start Time */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Giờ bắt đầu</Text>
                <ScrollView style={styles.timeList} nestedScrollEnabled>
                  {TIME_SLOTS.map((slot) => {
                    const sel = slot === startTime;
                    return (
                      <TouchableOpacity
                        key={`s-${slot}`}
                        style={[styles.timeItem, sel && styles.timeItemSel]}
                        onPress={() => setStartTime(slot)}
                      >
                        <Text style={[styles.timeText, sel && styles.timeTextSel]}>
                          {slot}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* End Time */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Giờ kết thúc</Text>
                <ScrollView style={styles.timeList} nestedScrollEnabled>
                  {TIME_SLOTS.map((slot) => {
                    const sel = slot === endTime;
                    return (
                      <TouchableOpacity
                        key={`e-${slot}`}
                        style={[styles.timeItem, sel && styles.timeItemSel]}
                        onPress={() => setEndTime(slot)}
                      >
                        <Text style={[styles.timeText, sel && styles.timeTextSel]}>
                          {slot}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Status & Overlap Warnings */}
            <View style={styles.statusBox}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Khung giờ đã chọn:</Text>
                <Text style={styles.previewValue}>
                  {formatWindow({ startTime, endTime })}
                </Text>
                {overnight && (
                  <View style={styles.overnightBadge}>
                    <Text style={styles.overnightBadgeText}>Qua đêm (+1 ngày)</Text>
                  </View>
                )}
              </View>

              {overlap && (
                <View style={styles.errorBox}>
                  <AlertTriangle size={15} color={tokens.colors.alertCrimson} style={styles.errorIcon} />
                  <Text style={styles.errorText}>
                    Bị trùng với khung giờ đã có ({formatWindow(overlap)}). Vui lòng chọn giờ khác.
                  </Text>
                </View>
              )}

              {startTime === endTime && (
                <View style={styles.errorBox}>
                  <AlertTriangle size={15} color={tokens.colors.alertCrimson} style={styles.errorIcon} />
                  <Text style={styles.errorText}>
                    Giờ kết thúc phải khác giờ bắt đầu.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              disabled={!canSave}
              onPress={handleSave}
            >
              <Text style={styles.saveBtnText}>Áp dụng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: tokens.colors.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: tokens.colors.brandJade,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: tokens.colors.inkSecondary,
    fontWeight: 'bold',
  },
  scrollBody: {
    maxHeight: 400,
  },
  scrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: tokens.colors.subtle,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  presetChipActive: {
    backgroundColor: tokens.colors.brandJadeSoft,
    borderColor: tokens.colors.brandJade,
  },
  presetChipText: {
    fontSize: 13,
    color: tokens.colors.inkPrimary,
    fontWeight: '500',
  },
  presetChipTextActive: {
    color: tokens.colors.brandJade,
    fontWeight: '700',
  },
  pickersRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  pickerCol: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  timeList: {
    height: 140,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: 10,
    backgroundColor: tokens.colors.canvas,
  },
  timeItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.subtle,
  },
  timeItemSel: {
    backgroundColor: tokens.colors.brandJade,
  },
  timeText: {
    fontSize: 15,
    color: tokens.colors.inkPrimary,
    fontWeight: '500',
  },
  timeTextSel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusBox: {
    backgroundColor: tokens.colors.subtle,
    borderRadius: 12,
    padding: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  previewLabel: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
  },
  previewValue: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  overnightBadge: {
    backgroundColor: tokens.colors.accentOchreSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  overnightBadgeText: {
    fontSize: 12,
    color: tokens.colors.accentOchre,
    fontWeight: '700',
  },
  errorBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  errorIcon: {
    marginTop: 2,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.alertCrimson,
    fontWeight: '600',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.paper,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 10,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
