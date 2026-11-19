import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { X } from 'lucide-react-native';
import { tokens } from '../../../styles/tokens';
import { newId, toISODate, type TimeOffException } from '@healthcare-system/shared';

export interface TimeOffSheetProps {
  visible: boolean;
  timeOffList: TimeOffException[];
  onAddTimeOff: (exceptions: TimeOffException[]) => void;
  onRemoveTimeOff: (id: string) => void;
  onClose: () => void;
}

const COMMON_REASONS = [
  'Việc cá nhân / gia đình',
  'Đi khám sức khỏe',
  'Nghỉ phép thường niên',
  'Tham gia khóa đào tạo y tế',
];

export const TimeOffSheet: React.FC<TimeOffSheetProps> = ({
  visible,
  timeOffList,
  onAddTimeOff,
  onRemoveTimeOff,
  onClose,
}) => {
  const [mode, setMode] = useState<'SINGLE' | 'RANGE'>('SINGLE');
  const [singleDate, setSingleDate] = useState(() => toISODate(new Date()));
  const [startDate, setStartDate] = useState(() => toISODate(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return toISODate(d);
  });
  const [reason, setReason] = useState('Việc cá nhân / gia đình');

  const handleAdd = () => {
    const newItems: TimeOffException[] = [];

    if (mode === 'SINGLE') {
      if (!singleDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        Alert.alert('Ngày không hợp lệ', 'Vui lòng nhập ngày theo định dạng YYYY-MM-DD (vd: 2026-11-20)');
        return;
      }
      newItems.push({
        id: newId('timeoff'),
        specificDate: singleDate,
        startTime: '00:00',
        endTime: '23:59',
      });
    } else {
      if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/) || !endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        Alert.alert('Ngày không hợp lệ', 'Vui lòng nhập ngày theo định dạng YYYY-MM-DD');
        return;
      }
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (e < s) {
        Alert.alert('Lỗi khoảng ngày', 'Ngày kết thúc không được trước ngày bắt đầu.');
        return;
      }

      // Loop through all dates in range
      const curr = new Date(s);
      while (curr <= e) {
        newItems.push({
          id: newId('timeoff'),
          specificDate: toISODate(curr),
          startTime: '00:00',
          endTime: '23:59',
        });
        curr.setDate(curr.getDate() + 1);
      }
    }

    onAddTimeOff(newItems);
    Alert.alert(
      'Đã đăng ký ngày nghỉ',
      `Đã thêm ${newItems.length} ngày nghỉ vào lịch. Vui lòng bấm "Lưu thay đổi lịch" để hoàn tất.`
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.sheetTitle}>Quản lý ngày nghỉ cụ thể</Text>
              <Text style={styles.sheetSubtitle}>
                Hệ thống sẽ không điều phối ca trực vào các ngày bạn đăng ký nghỉ.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={tokens.colors.inkSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            {/* Mode Selector */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, mode === 'SINGLE' && styles.modeTabActive]}
                onPress={() => setMode('SINGLE')}
              >
                <Text style={[styles.modeTabText, mode === 'SINGLE' && styles.modeTabTextActive]}>
                  Nghỉ 1 ngày
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, mode === 'RANGE' && styles.modeTabActive]}
                onPress={() => setMode('RANGE')}
              >
                <Text style={[styles.modeTabText, mode === 'RANGE' && styles.modeTabTextActive]}>
                  Nghỉ nhiều ngày (Khoảng ngày)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date Inputs */}
            {mode === 'SINGLE' ? (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Ngày nghỉ (YYYY-MM-DD):</Text>
                <TextInput
                  style={styles.input}
                  value={singleDate}
                  onChangeText={setSingleDate}
                  placeholder="2026-11-20"
                />
              </View>
            ) : (
              <View style={styles.rangeRow}>
                <View style={styles.rangeCol}>
                  <Text style={styles.label}>Từ ngày:</Text>
                  <TextInput
                    style={styles.input}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="2026-11-20"
                  />
                </View>
                <View style={styles.rangeCol}>
                  <Text style={styles.label}>Đến ngày:</Text>
                  <TextInput
                    style={styles.input}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="2026-11-22"
                  />
                </View>
              </View>
            )}

            {/* Quick Reasons */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Lý do nghỉ:</Text>
              <View style={styles.reasonsWrap}>
                {COMMON_REASONS.map((r) => {
                  const sel = reason === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.reasonChip, sel && styles.reasonChipSel]}
                      onPress={() => setReason(r)}
                    >
                      <Text style={[styles.reasonText, sel && styles.reasonTextSel]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
              <Text style={styles.addBtnText}>+ Thêm ngày nghỉ</Text>
            </TouchableOpacity>

            {/* Existing Time Off Exceptions */}
            <View style={styles.existingSection}>
              <Text style={styles.existingTitle}>
                Danh sách ngày nghỉ đã đăng ký ({timeOffList.length}):
              </Text>

              {timeOffList.length === 0 ? (
                <Text style={styles.noTimeOffText}>Chưa có ngày nghỉ nào được đăng ký.</Text>
              ) : (
                <View style={styles.existingList}>
                  {timeOffList.map((item) => (
                    <View key={item.id} style={styles.timeOffItem}>
                      <View>
                        <Text style={styles.timeOffDateText}>{item.specificDate}</Text>
                        <Text style={styles.timeOffSubText}>Nghỉ cả ngày</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => onRemoveTimeOff(item.id)}
                      >
                        <Text style={styles.removeBtnText}>Hủy nghỉ</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Xong</Text>
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
    maxHeight: '90%',
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
    fontSize: 13,
    color: tokens.colors.inkSecondary,
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
    maxHeight: 460,
  },
  scrollContent: {
    padding: 20,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.subtle,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: tokens.colors.paper,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  modeTabText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  modeTabTextActive: {
    color: tokens.colors.brandJade,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: tokens.colors.inkPrimary,
    backgroundColor: tokens.colors.canvas,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  rangeCol: {
    flex: 1,
  },
  reasonsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: tokens.colors.subtle,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  reasonChipSel: {
    backgroundColor: tokens.colors.brandJadeSoft,
    borderColor: tokens.colors.brandJade,
  },
  reasonText: {
    fontSize: 13,
    color: tokens.colors.inkPrimary,
  },
  reasonTextSel: {
    color: tokens.colors.brandJade,
    fontWeight: '700',
  },
  addBtn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  existingSection: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
    paddingTop: 16,
  },
  existingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 10,
  },
  noTimeOffText: {
    fontSize: 13.5,
    color: tokens.colors.inkMuted,
    fontStyle: 'italic',
  },
  existingList: {
    gap: 8,
  },
  timeOffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  timeOffDateText: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  timeOffSubText: {
    fontSize: 12,
    color: tokens.colors.inkSecondary,
  },
  removeBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  removeBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.alertCrimson,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  doneBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: tokens.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
});
