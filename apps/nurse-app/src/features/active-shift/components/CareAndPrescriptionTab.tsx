import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Alert } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { IS_DEV } from '../../../lib/hardware-providers';
import { DEFAULT_TRAVEL_SUPPORT_VND } from '@healthcare-system/shared';

export interface CareActivityItem {
  id: string;
  title: string;
  completed: boolean;
}

interface CareAndPrescriptionTabProps {
  activities: CareActivityItem[];
  isInvasive: boolean;
  rejecting?: boolean;
  onCaptureEvidencePhoto?: () => Promise<string | null>;
  onToggleActivity: (id: string) => void;
  onPrescriptionRejected: (payload: { reason: string; evidencePhotoUri: string }) => void;
}

const REJECTION_REASONS = [
  'Đơn thuốc hết hạn quá 7 ngày',
  'Gia đình không có y lệnh bản gốc tại nhà',
  'Thuốc thực tế không trùng khớp tên hoặc hàm lượng',
  'Nghi ngờ đơn thuốc bị chỉnh sửa / tẩy xóa',
];

export const CareAndPrescriptionTab: React.FC<CareAndPrescriptionTabProps> = ({
  activities,
  isInvasive,
  rejecting = false,
  onCaptureEvidencePhoto,
  onToggleActivity,
  onPrescriptionRejected,
}) => {
  const [showRejectionPanel, setShowRejectionPanel] = useState(false);
  const [selectedReason, setSelectedReason] = useState(REJECTION_REASONS[0]);
  const [evidencePhotoUri, setEvidencePhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const completedCount = activities.filter((a) => a.completed).length;

  const handleCaptureEvidence = async () => {
    if (onCaptureEvidencePhoto) {
      try {
        const uri = await onCaptureEvidencePhoto();
        if (uri) {
          setEvidencePhotoUri(uri);
          Alert.alert('Đã chụp ảnh bằng chứng', 'Ảnh thuốc / đơn thuốc đã được lưu đính kèm hồ sơ đối chiếu.');
        }
      } catch {
        Alert.alert('Lỗi camera', 'Không thể mở camera thiết bị. Vui lòng kiểm tra quyền truy cập camera.');
      }
      return;
    }

    if (IS_DEV) {
      setEvidencePhotoUri(
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80'
      );
      Alert.alert('[DEV] Ảnh bằng chứng mẫu', 'Chỉ dùng ảnh mẫu trong môi trường phát triển.');
      return;
    }

    Alert.alert(
      'Chưa hỗ trợ camera phần cứng',
      'Ứng dụng cần kết nối camera trực tiếp (onCaptureEvidencePhoto) để chụp ảnh bằng chứng y lệnh.'
    );
  };

  const handleConfirmReject = () => {
    if (!evidencePhotoUri) {
      Alert.alert('Thiếu ảnh bằng chứng', 'Bắt buộc chụp ảnh y lệnh hoặc hộp thuốc sai lệch bằng camera trực tiếp.');
      return;
    }
    Alert.alert(
      'Xác nhận từ chối ca không phạt',
      `Ca trực sẽ dừng ngay lập tức. Bạn không bị phạt tiền, không trừ điểm tin cậy và nhận ${DEFAULT_TRAVEL_SUPPORT_VND.toLocaleString('vi-VN')}đ hỗ trợ đi lại.`,
      [
        { text: 'Xem lại', style: 'cancel' },
        {
          text: 'Xác nhận dừng ca',
          style: 'destructive',
          onPress: () =>
            onPrescriptionRejected({
              reason: `${selectedReason}${notes ? ` (${notes})` : ''}`,
              evidencePhotoUri,
            }),
        },
      ]
    );
  };

  return (
    <View style={{ gap: 14 }}>
      {/* Danh mục nhiệm vụ chăm sóc */}
      <View style={styles.ledgerCard}>
        <View style={styles.headRow}>
          <Text style={styles.cardTitle}>Quy trình chăm sóc điều dưỡng</Text>
          <Text style={styles.counterText}>
            {completedCount} / {activities.length} hoàn thành
          </Text>
        </View>

        {activities.map((item, idx) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.checkRow, idx === activities.length - 1 && { borderBottomWidth: 0 }]}
            onPress={() => onToggleActivity(item.id)}
          >
            <View style={[styles.checkbox, item.completed && styles.checkboxChecked]}>
              {item.completed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.checkLabel, item.completed && styles.checkLabelDone]}>
              {item.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cổng an toàn y lệnh cho ca Cấp 2 */}
      {isInvasive && (
        <View style={[styles.ledgerCard, { borderColor: '#FECACA', backgroundColor: '#FFFDFD' }]}>
          <Text style={[styles.cardTitle, { color: tokens.colors.alertCrimson }]}>
            Đối chiếu y lệnh thuốc tại nhà
          </Text>
          <Text style={styles.cardSub}>
            Nếu phát hiện thuốc không đúng y lệnh gốc, quá hạn trên 7 ngày hoặc thiếu bản giấy: hãy dừng thủ thuật ngay để bảo vệ an toàn người bệnh và bản thân. Bạn vẫn nhận được {DEFAULT_TRAVEL_SUPPORT_VND.toLocaleString('vi-VN')}đ hỗ trợ chi phí đi lại.
          </Text>

          {!showRejectionPanel ? (
            <TouchableOpacity
              style={styles.rejectTriggerBtn}
              onPress={() => setShowRejectionPanel(true)}
            >
              <Text style={styles.rejectTriggerText}>Báo cáo y lệnh sai và dừng ca an toàn</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.rejectionForm}>
              <Text style={styles.formLabel}>Chọn lý do phát hiện tại chỗ</Text>
              {REJECTION_REASONS.map((r) => {
                const active = selectedReason === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.reasonBtn, active && styles.reasonBtnActive]}
                    onPress={() => setSelectedReason(r)}
                  >
                    <Text style={[styles.reasonText, active && { color: tokens.colors.alertCrimson, fontWeight: '700' }]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={[styles.formLabel, { marginTop: 10 }]}>Ảnh bằng chứng (Camera trực tiếp)</Text>
              {evidencePhotoUri ? (
                <View style={styles.evidencePreview}>
                  <Image source={{ uri: evidencePhotoUri }} style={styles.evidenceImg} />
                  <TouchableOpacity style={styles.retakePill} onPress={handleCaptureEvidence}>
                    <Text style={styles.retakePillText}>Chụp lại</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.cameraBtn} onPress={handleCaptureEvidence}>
                  <Text style={styles.cameraBtnText}>Mở camera chụp đơn thuốc / hộp thuốc</Text>
                </TouchableOpacity>
              )}

              <Text style={[styles.formLabel, { marginTop: 10 }]}>Ghi chú thêm (nếu có)</Text>
              <TextInput
                style={styles.noteInput}
                multiline
                placeholder="Ghi rõ tên thuốc sai lệch hoặc tình trạng giấy tờ..."
                value={notes}
                onChangeText={setNotes}
                placeholderTextColor={tokens.colors.inkMuted}
              />

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelFormBtn}
                  disabled={rejecting}
                  onPress={() => setShowRejectionPanel(false)}
                >
                  <Text style={styles.cancelFormText}>Đóng lại</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmRejectBtn, rejecting && { opacity: 0.65 }]}
                  disabled={rejecting}
                  onPress={handleConfirmReject}
                >
                  <Text style={styles.confirmRejectText}>
                    {rejecting ? 'Đang gửi...' : 'Gửi báo cáo hủy ca'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
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
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 17.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  cardSub: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 14,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: tokens.colors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: tokens.colors.brandJade,
    borderColor: tokens.colors.brandJade,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  checkLabel: {
    flex: 1,
    fontSize: 15.5,
    color: tokens.colors.inkPrimary,
    lineHeight: 22,
  },
  checkLabelDone: {
    textDecorationLine: 'line-through',
    color: tokens.colors.inkMuted,
  },
  rejectTriggerBtn: {
    height: tokens.spacing.touchTargetMin,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: tokens.colors.alertCrimson,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.paper,
  },
  rejectTriggerText: {
    color: tokens.colors.alertCrimson,
    fontSize: 15,
    fontWeight: '700',
  },
  rejectionForm: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 8,
  },
  reasonBtn: {
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    backgroundColor: tokens.colors.paper,
    marginBottom: 6,
  },
  reasonBtnActive: {
    borderColor: tokens.colors.alertCrimson,
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  reasonText: {
    fontSize: 14.5,
    color: tokens.colors.inkPrimary,
  },
  cameraBtn: {
    height: 84,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colors.alertCrimson,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cameraBtnText: {
    color: tokens.colors.alertCrimson,
    fontSize: 14.5,
    fontWeight: '700',
  },
  evidencePreview: {
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  evidenceImg: {
    width: '100%',
    height: '100%',
  },
  retakePill: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(16, 42, 36, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  retakePillText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: 10,
    backgroundColor: tokens.colors.paper,
    padding: 10,
    fontSize: 14.5,
    minHeight: 68,
    textAlignVertical: 'top',
    color: tokens.colors.inkPrimary,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelFormBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.paper,
  },
  cancelFormText: {
    color: tokens.colors.inkSecondary,
    fontWeight: '600',
  },
  confirmRejectBtn: {
    flex: 2,
    height: 46,
    borderRadius: 10,
    backgroundColor: tokens.colors.alertCrimson,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmRejectText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

