import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { DEFAULT_SURCHARGE_HEAVY_PATIENT_RATE } from '@healthcare-system/shared';

interface AssessmentTabProps {
  completed: boolean;
  mobility: string;
  mismatchReported: boolean;
  saving?: boolean;
  onSaveAssessment: (params: {
    mobility: string;
    hasMismatch: boolean;
    mismatchAction?: 'SURCHARGE' | 'STOP_NO_PENALTY';
    reason?: string;
  }) => void;
}

const MOBILITY_OPTIONS = [
  { key: 'INDEPENDENT', label: 'Tự đi lại bình thường' },
  { key: 'PARTIAL', label: 'Hỗ trợ xe lăn / Đỡ di chuyển' },
  { key: 'BEDRIDDEN', label: 'Nằm liệt giường / Hạn chế hoàn toàn' },
];

export const AssessmentTab: React.FC<AssessmentTabProps> = ({
  completed,
  mobility,
  mismatchReported,
  saving = false,
  onSaveAssessment,
}) => {
  const [selectedMobility, setSelectedMobility] = useState(mobility || 'PARTIAL');
  const [hasMismatch, setHasMismatch] = useState(mismatchReported);
  const [mismatchAction, setMismatchAction] = useState<'SURCHARGE' | 'STOP_NO_PENALTY'>('SURCHARGE');
  const [reason, setReason] = useState('');

  const surchargePercent = Math.round(DEFAULT_SURCHARGE_HEAVY_PATIENT_RATE * 100);

  const handleSave = () => {
    if (hasMismatch && reason.trim().length < 5) {
      Alert.alert('Cần ghi rõ mô tả', 'Vui lòng mô tả sai lệch thể trạng thực tế (ít nhất 5 ký tự).');
      return;
    }
    onSaveAssessment({
      mobility: selectedMobility,
      hasMismatch,
      mismatchAction: hasMismatch ? mismatchAction : undefined,
      reason: hasMismatch ? reason.trim() : undefined,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.ledgerCard}>
        <View style={styles.headRow}>
          <Text style={styles.cardTitle}>Đánh giá thể trạng 30 phút đầu ca</Text>
          <View
            style={[
              styles.pill,
              { backgroundColor: completed ? tokens.colors.brandJadeSoft : tokens.colors.accentOchreSoft },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: completed ? tokens.colors.brandJade : tokens.colors.accentOchre },
              ]}
            >
              {completed ? 'Đã hoàn tất' : 'Cần thực hiện'}
            </Text>
          </View>
        </View>

        <Text style={styles.description}>
          Quan sát tri giác, mức độ vận động và so sánh với mô tả khi đặt ca để bảo đảm an toàn chăm sóc.
        </Text>

        <Text style={styles.label}>Mức độ vận động thực tế tại nhà</Text>
        <View style={styles.optionsList}>
          {MOBILITY_OPTIONS.map((opt) => {
            const active = selectedMobility === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionBtn, active && styles.optionBtnActive]}
                onPress={() => setSelectedMobility(opt.key)}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sai lệch thể trạng */}
        <TouchableOpacity
          style={styles.mismatchToggle}
          onPress={() => setHasMismatch((v) => !v)}
        >
          <View style={[styles.checkbox, hasMismatch && styles.checkboxChecked]}>
            {hasMismatch && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mismatchTitle}>Phát hiện thể trạng thực tế nặng hơn mô tả</Text>
            <Text style={styles.mismatchSub}>
              Ví dụ: người bệnh liệt giường hoặc cần chăm sóc đặc biệt chưa khai báo trước
            </Text>
          </View>
        </TouchableOpacity>

        {hasMismatch && (
          <View style={styles.mismatchBox}>
            <Text style={styles.label}>Chọn hướng xử lý phù hợp</Text>
            <TouchableOpacity
              style={[
                styles.actionChoice,
                mismatchAction === 'SURCHARGE' && styles.actionChoiceActive,
              ]}
              onPress={() => setMismatchAction('SURCHARGE')}
            >
              <Text style={styles.actionChoiceTitle}>
                Tiếp tục ca và đề xuất phụ phí (+{surchargePercent}%)
              </Text>
              <Text style={styles.actionChoiceDesc}>
                Gửi thông báo xác nhận phụ phí chăm sóc người bệnh nặng tới gia đình
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionChoice,
                mismatchAction === 'STOP_NO_PENALTY' && styles.actionChoiceCrimson,
              ]}
              onPress={() => setMismatchAction('STOP_NO_PENALTY')}
            >
              <Text style={[styles.actionChoiceTitle, { color: tokens.colors.alertCrimson }]}>
                Dừng ca an toàn (vượt quá năng lực hiện tại)
              </Text>
              <Text style={styles.actionChoiceDesc}>
                Không bị phạt tiền và không bị trừ điểm tin cậy
              </Text>
            </TouchableOpacity>

            <Text style={[styles.label, { marginTop: 10 }]}>Mô tả chi tiết tình trạng thực tế</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={3}
              placeholder="Ghi rõ tình trạng người bệnh (VD: bệnh nhân nặng cần 2 người hỗ trợ xoay trở...)"
              value={reason}
              onChangeText={setReason}
              placeholderTextColor={tokens.colors.inkMuted}
            />
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.saveBtn,
            hasMismatch && mismatchAction === 'STOP_NO_PENALTY' && { backgroundColor: tokens.colors.alertCrimson },
            saving && { opacity: 0.65 },
          ]}
          disabled={saving}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>
            {saving
              ? 'Đang gửi lên hệ thống...'
              : hasMismatch && mismatchAction === 'STOP_NO_PENALTY'
              ? 'Xác nhận dừng ca do sai lệch'
              : completed
              ? 'Cập nhật đánh giá 30 phút'
              : 'Lưu đánh giá ban đầu'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  ledgerCard: {
    backgroundColor: tokens.colors.paper,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: 14,
    padding: 16,
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 17.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    flex: 1,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  description: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 21,
    marginBottom: 14,
  },
  label: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 8,
  },
  optionsList: {
    gap: 8,
    marginBottom: 16,
  },
  optionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    backgroundColor: tokens.colors.canvas,
  },
  optionBtnActive: {
    borderColor: tokens.colors.brandJade,
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  optionText: {
    fontSize: 15.5,
    fontWeight: '500',
    color: tokens.colors.inkPrimary,
  },
  optionTextActive: {
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  mismatchToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: tokens.colors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: tokens.colors.accentOchre,
    borderColor: tokens.colors.accentOchre,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  mismatchTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  mismatchSub: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
    lineHeight: 19,
  },
  mismatchBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: tokens.colors.canvas,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  actionChoice: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    backgroundColor: tokens.colors.paper,
    marginBottom: 8,
  },
  actionChoiceActive: {
    borderColor: tokens.colors.brandJade,
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  actionChoiceCrimson: {
    borderColor: tokens.colors.alertCrimson,
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  actionChoiceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 2,
  },
  actionChoiceDesc: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 19,
  },
  textArea: {
    backgroundColor: tokens.colors.paper,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: tokens.colors.inkPrimary,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: 14,
    height: tokens.spacing.touchTargetMin,
    borderRadius: 12,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

