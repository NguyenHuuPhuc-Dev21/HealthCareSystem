import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { tokens } from '../../../styles/tokens';
import {
  DEFAULT_SETTLEMENT_COOLING_HOURS,
  DEFAULT_RECORD_ACCESS_EXPIRY_HOURS,
} from '@healthcare-system/shared';

interface HandoverCheckoutTabProps {
  assessmentCompleted: boolean;
  completedActivitiesCount: number;
  totalActivitiesCount: number;
  onSubmitCheckOut: (payload: {
    finalHr: string;
    finalBp: string;
    handoverNote: string;
  }) => void;
}

export const HandoverCheckoutTab: React.FC<HandoverCheckoutTabProps> = ({
  assessmentCompleted,
  completedActivitiesCount,
  totalActivitiesCount,
  onSubmitCheckOut,
}) => {
  const [finalHr, setFinalHr] = useState('75');
  const [finalBp, setFinalBp] = useState('120/80');
  const [handoverNote, setHandoverNote] = useState('');

  const allActivitiesDone = completedActivitiesCount === totalActivitiesCount;

  const handleComplete = () => {
    if (!assessmentCompleted) {
      Alert.alert(
        'Chưa hoàn tất đánh giá 30 phút',
        'Vui lòng quay lại mục Sàng lọc 30p để lưu đánh giá thể trạng trước khi ra về.'
      );
      return;
    }
    if (!finalHr.trim() || !finalBp.trim()) {
      Alert.alert('Thiếu sinh tồn cuối ca', 'Cần ghi nhận Mạch và Huyết áp trước khi bàn giao.');
      return;
    }
    if (handoverNote.trim().length < 10) {
      Alert.alert(
        'Thiếu ghi chú bàn giao',
        'Vui lòng nhập tóm tắt tình trạng người bệnh và dặn dò gia đình (tối thiểu 10 ký tự).'
      );
      return;
    }

    onSubmitCheckOut({
      finalHr: finalHr.trim(),
      finalBp: finalBp.trim(),
      handoverNote: handoverNote.trim(),
    });
  };

  return (
    <View style={{ gap: 14 }}>
      {/* Kiểm tra điều kiện hoàn tất ca */}
      <View style={styles.ledgerCard}>
        <Text style={styles.cardTitle}>Kiểm tra trước khi kết thúc ca</Text>
        <View style={styles.gateRow}>
          <Text style={styles.gateLabel}>Đánh giá thể trạng 30 phút</Text>
          <Text style={[styles.gateState, { color: assessmentCompleted ? tokens.colors.brandJade : tokens.colors.accentOchre }]}>
            {assessmentCompleted ? 'Đã xong' : 'Chưa lưu'}
          </Text>
        </View>
        <View style={[styles.gateRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
          <Text style={styles.gateLabel}>Quy trình chăm sóc đã thực hiện</Text>
          <Text style={[styles.gateState, { color: allActivitiesDone ? tokens.colors.brandJade : tokens.colors.inkPrimary }]}>
            {completedActivitiesCount} / {totalActivitiesCount} mục
          </Text>
        </View>
      </View>

      {/* Biểu mẫu bàn giao bắt buộc */}
      <View style={styles.ledgerCard}>
        <Text style={styles.cardTitle}>Báo cáo ca tối thiểu và bàn giao</Text>
        <Text style={styles.cardSub}>
          Hệ thống yêu cầu hoàn tất báo cáo này trước khi đóng ca và gửi bản tóm tắt cho người nhà.
        </Text>

        <View style={styles.rowInputs}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Mạch cuối ca (l/phút)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={finalHr} onChangeText={setFinalHr} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Huyết áp cuối ca</Text>
            <TextInput style={styles.input} value={finalBp} onChangeText={setFinalBp} />
          </View>
        </View>

        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Tình trạng người bệnh và dặn dò gia đình</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={4}
          placeholder="Ghi nhận vết thương, ăn uống, giấc ngủ hoặc lưu ý cho ca tiếp theo..."
          value={handoverNote}
          onChangeText={setHandoverNote}
          placeholderTextColor={tokens.colors.inkMuted}
        />

        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            Sau khi bấm kết thúc ca: Thù lao tự động quyết toán sau {DEFAULT_SETTLEMENT_COOLING_HOURS} giờ (nếu không có phản hồi bất thường) và quyền xem hồ sơ bệnh án đóng lại sau {DEFAULT_RECORD_ACCESS_EXPIRY_HOURS} giờ để bảo vệ quyền riêng tư.
          </Text>
        </View>

        <TouchableOpacity style={styles.checkoutBtn} onPress={handleComplete}>
          <Text style={styles.checkoutBtnText}>Lưu báo cáo và kết thúc ca</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  ledgerCard: {
    backgroundColor: tokens.colors.paper,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: {
    fontSize: 17.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  gateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  gateLabel: {
    fontSize: 15,
    color: tokens.colors.inkSecondary,
  },
  gateState: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    backgroundColor: tokens.colors.canvas,
  },
  textArea: {
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: 10,
    backgroundColor: tokens.colors.canvas,
    padding: 12,
    fontSize: 15,
    minHeight: 96,
    textAlignVertical: 'top',
    color: tokens.colors.inkPrimary,
  },
  noticeBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: tokens.colors.canvas,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  noticeText: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
  },
  checkoutBtn: {
    marginTop: 16,
    height: 54,
    borderRadius: 12,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});

