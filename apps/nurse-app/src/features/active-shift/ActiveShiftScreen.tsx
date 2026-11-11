import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Linking,
  Modal,
} from 'react-native';
import { tokens } from '../../styles/tokens';
import { triggerSos } from '../sos/sos.api';
import {
  DEFAULT_TRAVEL_SUPPORT_VND,
  DEFAULT_SETTLEMENT_COOLING_HOURS,
  DEFAULT_RECORD_ACCESS_EXPIRY_HOURS,
} from '@healthcare-system/shared';

interface ActiveShiftScreenProps {
  bookingId: string;
  bookingCode: string;
  patientName: string;
  patientAge: number;
  patientAddress: string;
  patientLatitude: number;
  patientLongitude: number;
  serviceName: string;
  isInvasive: boolean;
  onShiftCompleted: () => void;
}

export const ActiveShiftScreen: React.FC<ActiveShiftScreenProps> = ({
  bookingId,
  bookingCode,
  patientName,
  patientAge,
  patientAddress,
  patientLatitude,
  patientLongitude,
  serviceName,
  isInvasive,
  onShiftCompleted,
}) => {
  // Assessment 30-min state
  const [assessmentCompleted, setAssessmentCompleted] = useState<boolean>(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState<boolean>(false);
  const [actualMobility, setActualMobility] = useState<string>('NORMAL');
  const [hasMismatch, setHasMismatch] = useState<boolean>(false);
  const [mismatchReason, setMismatchReason] = useState<string>('');

  // Vital signs state
  const [heartRate, setHeartRate] = useState<string>('76');
  const [bpSystolic, setBpSystolic] = useState<string>('120');
  const [bpDiastolic, setBpDiastolic] = useState<string>('80');
  const [temp, setTemp] = useState<string>('36.8');
  const [spo2, setSpo2] = useState<string>('98');
  const [vitalsList, setVitalsList] = useState<Array<{ time: string; hr: string; bp: string; temp: string; spo2: string }>>([
    { time: '08:05', hr: '76', bp: '120/80', temp: '36.8', spo2: '98' },
  ]);

  // Care activities
  const [activities, setActivities] = useState<Array<{ id: string; title: string; completed: boolean }>>([
    { id: '1', title: 'Đo sinh tồn ban đầu (Mạch, HA, Thân nhiệt, SpO2)', completed: true },
    { id: '2', title: 'Đối chiếu y lệnh gốc và thuốc/vật tư tại chỗ', completed: false },
    { id: '3', title: 'Thực hiện chăm sóc & quy trình điều dưỡng', completed: false },
    { id: '4', title: 'Đo sinh tồn cuối ca & dặn dò gia đình', completed: false },
  ]);

  // Extension request
  const [pendingExtension, setPendingExtension] = useState<{ hours: number; extraAmount: number } | null>({
    hours: 1,
    extraAmount: 162500,
  });

  // Check-out modal
  const [showCheckOutModal, setShowCheckOutModal] = useState<boolean>(false);
  const [handoverNote, setHandoverNote] = useState<string>('');
  const [finalHr, setFinalHr] = useState<string>('75');
  const [finalBp, setFinalBp] = useState<string>('120/80');

  // SOS Trigger (Zero Latency Call + Background API) (BR-23)
  const handleTriggerSos = () => {
    Alert.alert(
      'KÍCH HOẠT SOS CẤP CỨU',
      'Ứng dụng sẽ mở ngay trình gọi 115 và đồng thời gửi cảnh báo GPS tới Admin & Người nhà.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'GỌI 115 NGAY',
          style: 'destructive',
          onPress: () => {
            // 1. Native dialer 115 (Zero network latency)
            Linking.openURL('tel:115');

            // 2. Parallel background alert (< 2s)
            triggerSos({
              bookingId,
              latitude: patientLatitude,
              longitude: patientLongitude,
              currentVitals: { heartRate, bpSystolic, bpDiastolic, temp, spo2 },
            });
          },
        },
      ]
    );
  };

  // Toggle activity
  const toggleActivity = (id: string) => {
    setActivities(
      activities.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a))
    );
  };

  // Add vital sign
  const handleAddVitals = () => {
    if (!heartRate || !bpSystolic || !bpDiastolic || !temp || !spo2) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đủ các chỉ số sinh tồn.');
      return;
    }
    const newEntry = {
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      hr: heartRate,
      bp: `${bpSystolic}/${bpDiastolic}`,
      temp,
      spo2,
    };
    setVitalsList([newEntry, ...vitalsList]);
    Alert.alert('Thành công', 'Đã lưu chỉ số sinh tồn và đồng bộ thời gian thực.');
  };

  // Save 30-min Assessment
  const handleSaveAssessment = () => {
    if (hasMismatch && mismatchReason.trim().length < 5) {
      Alert.alert('Yêu cầu lý do', 'Vui lòng nhập chi tiết sai lệch tình trạng bệnh nhân.');
      return;
    }
    setAssessmentCompleted(true);
    setShowAssessmentModal(false);
    Alert.alert(
      'Đã hoàn thành',
      hasMismatch
        ? 'Đã báo cáo sai lệch tình trạng tới đội ngũ điều phối (BR-16).'
        : 'Đã hoàn tất đánh giá tình trạng ban đầu 30 phút.'
    );
  };

  // Check-Out Submission
  const handleCheckOut = () => {
    if (!handoverNote || handoverNote.trim().length < 10) {
      Alert.alert('Báo cáo chưa đủ', 'Bắt buộc phải nhập ghi chú dặn dò/bàn giao tối thiểu 10 ký tự cho người nhà (BR-22).');
      return;
    }
    setShowCheckOutModal(false);
    Alert.alert(
      'Ca trực hoàn tất!',
      `Đã nộp Báo cáo ca tối thiểu. Kích hoạt đếm ngược ${DEFAULT_SETTLEMENT_COOLING_HOURS}h tự động giải ngân và ${DEFAULT_RECORD_ACCESS_EXPIRY_HOURS}h khóa xem bệnh án.`,
      [{ text: 'Đồng ý', onPress: onShiftCompleted }]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{serviceName}</Text>
          <Text style={styles.subtitle}>
            Đơn {bookingCode} · Bệnh nhân: {patientName} ({patientAge}t)
          </Text>
        </View>
        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>● ĐANG DIỄN RA</Text>
        </View>
      </View>

      {/* Emergency SOS Button (Always Fixed & Prominent) */}
      <TouchableOpacity style={styles.sosButton} onPress={handleTriggerSos}>
        <Text style={styles.sosButtonText}>🚨 BÁO ĐỘNG SOS (GỌI 115 NGAY)</Text>
      </TouchableOpacity>

      {/* Extension Alert Banner (if pending) */}
      {pendingExtension && (
        <View style={styles.extensionBanner}>
          <Text style={styles.extensionTitle}>
            Khách hàng xin gia hạn thêm +{pendingExtension.hours} giờ
          </Text>
          <Text style={styles.extensionDesc}>
            Thu nhập tăng thêm: +{pendingExtension.extraAmount.toLocaleString('vi-VN')}đ.
          </Text>
          <View style={styles.extensionRow}>
            <TouchableOpacity
              style={styles.extDecline}
              onPress={() => {
                setPendingExtension(null);
                Alert.alert('Từ chối', 'Đã từ chối gia hạn ca.');
              }}
            >
              <Text style={styles.extDeclineText}>Từ chối</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.extAccept}
              onPress={() => {
                setPendingExtension(null);
                Alert.alert('Chấp thuận', 'Đã đồng ý kéo dài ca trực thêm 1 giờ.');
              }}
            >
              <Text style={styles.extAcceptText}>Đồng ý gia hạn</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 30-min Assessment Callout */}
      {!assessmentCompleted ? (
        <TouchableOpacity
          style={styles.assessmentCard}
          onPress={() => setShowAssessmentModal(true)}
        >
          <Text style={styles.assessmentTitle}>⏱ Báo cáo đánh giá ban đầu 30 phút</Text>
          <Text style={styles.assessmentDesc}>
            Bắt buộc đối soát mức độ vận động và tình trạng thực tế của người bệnh (FR-SHIFT-02).
          </Text>
          <Text style={styles.assessmentLink}>Bấm vào đây để hoàn thành →</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.completedBadge}>
          <Text style={styles.completedText}>✓ Đã hoàn tất đánh giá ban đầu 30 phút</Text>
        </View>
      )}

      {/* Clinical Care Logging (Vital Signs) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Chỉ số sinh tồn (Vital Signs)</Text>
        <View style={styles.vitalsRow}>
          <View style={styles.vitalInputGroup}>
            <Text style={styles.vitalLabel}>Mạch (bpm)</Text>
            <TextInput
              style={styles.vitalInput}
              keyboardType="numeric"
              value={heartRate}
              onChangeText={setHeartRate}
            />
          </View>
          <View style={styles.vitalInputGroup}>
            <Text style={styles.vitalLabel}>Huyết áp</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={[styles.vitalInput, { flex: 1 }]}
                keyboardType="numeric"
                value={bpSystolic}
                onChangeText={setBpSystolic}
              />
              <Text>/</Text>
              <TextInput
                style={[styles.vitalInput, { flex: 1 }]}
                keyboardType="numeric"
                value={bpDiastolic}
                onChangeText={setBpDiastolic}
              />
            </View>
          </View>
          <View style={styles.vitalInputGroup}>
            <Text style={styles.vitalLabel}>SpO2 (%)</Text>
            <TextInput
              style={styles.vitalInput}
              keyboardType="numeric"
              value={spo2}
              onChangeText={setSpo2}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.recordVitalsBtn} onPress={handleAddVitals}>
          <Text style={styles.recordVitalsText}>+ Lưu Chỉ Số Sinh Tồn</Text>
        </TouchableOpacity>

        {/* History */}
        <View style={{ marginTop: 10 }}>
          {vitalsList.map((item, idx) => (
            <View key={idx} style={styles.historyRow}>
              <Text style={styles.historyTime}>{item.time}</Text>
              <Text style={styles.historyDetail}>
                Mạch: {item.hr} | HA: {item.bp} | SpO2: {item.spo2}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Care Activities Checklist */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Đầu việc chăm sóc ({activities.filter((a) => a.completed).length}/{activities.length})
        </Text>
        {activities.map((act) => (
          <TouchableOpacity
            key={act.id}
            style={styles.activityItem}
            onPress={() => toggleActivity(act.id)}
          >
            <Text style={{ fontSize: 18, marginRight: 10 }}>
              {act.completed ? '☑' : '☐'}
            </Text>
            <Text
              style={[
                styles.activityTitle,
                act.completed && { textDecorationLine: 'line-through', color: '#16a34a' },
              ]}
            >
              {act.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* On-Site Invalid Prescription Gate (Tier 2 Invasive only) */}
      {isInvasive && (
        <TouchableOpacity
          style={styles.rejectOrderBtn}
          onPress={() => {
            Alert.alert(
              'Từ chối do y lệnh không hợp lệ',
              `Nếu đơn thuốc sai lệch hoặc không có bản gốc: Ca hủy ngay, bạn không bị phạt tiền, không trừ TrustScore và nhận ${DEFAULT_TRAVEL_SUPPORT_VND.toLocaleString('vi-VN')}đ hỗ trợ di chuyển (BR-15 §2.2).`,
              [
                { text: 'Quay lại', style: 'cancel' },
                {
                  text: 'Chụp ảnh từ chối ca',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert('Thành công', 'Đã ghi nhận hủy ca do y lệnh không hợp lệ (BR-15).');
                    onShiftCompleted();
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.rejectOrderText}>⚠️ Báo cáo y lệnh sai / Thuốc không khớp (Không phạt)</Text>
        </TouchableOpacity>
      )}

      {/* Check-Out Action Button */}
      <TouchableOpacity
        style={styles.checkoutBtn}
        onPress={() => setShowCheckOutModal(true)}
      >
        <Text style={styles.checkoutBtnText}>Nộp Báo Cáo Ca &amp; Check-Out →</Text>
      </TouchableOpacity>

      {/* Modal: 30-min Initial Assessment */}
      <Modal visible={showAssessmentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Đánh Giá Ban Đầu 30 Phút</Text>
            <Text style={styles.modalDesc}>Mức độ vận động thực tế của người bệnh:</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 8 }}>
              {['NORMAL', 'PARTIAL', 'BEDRIDDEN'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.mobilityBtn, actualMobility === m && styles.mobilityActive]}
                  onPress={() => setActualMobility(m)}
                >
                  <Text style={{ fontSize: 12, color: actualMobility === m ? '#fff' : '#0f172a' }}>
                    {m === 'NORMAL' ? 'Tự đi lại' : m === 'PARTIAL' ? 'Hỗ trợ 1 phần' : 'Liệt giường'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={{ marginVertical: 8 }}
              onPress={() => setHasMismatch(!hasMismatch)}
            >
              <Text style={{ color: hasMismatch ? tokens.colors.error : tokens.colors.textMuted }}>
                {hasMismatch ? '☑ Báo cáo sai lệch so với khai báo ban đầu' : '☐ Tình trạng khớp với khai báo'}
              </Text>
            </TouchableOpacity>

            {hasMismatch && (
              <TextInput
                style={styles.mismatchInput}
                placeholder="Lý do sai lệch (vd: bệnh nhân nặng hơn khai báo)..."
                value={mismatchReason}
                onChangeText={setMismatchReason}
              />
            )}

            <View style={styles.modalRow}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowAssessmentModal(false)}
              >
                <Text style={{ color: tokens.colors.textMuted }}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleSaveAssessment}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Xác Nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Check-Out Report */}
      <Modal visible={showCheckOutModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Báo Cáo Ca Tối Thiểu (Check-Out)</Text>
            <Text style={styles.modalDesc}>
              Bắt buộc nhập sinh tồn cuối ca và ghi chú dặn dò để hoàn tất (BR-22).
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vitalLabel}>Mạch cuối (bpm)</Text>
                <TextInput
                  style={styles.vitalInput}
                  value={finalHr}
                  onChangeText={setFinalHr}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vitalLabel}>Huyết áp cuối</Text>
                <TextInput
                  style={styles.vitalInput}
                  value={finalBp}
                  onChangeText={setFinalBp}
                />
              </View>
            </View>

            <Text style={styles.vitalLabel}>Ghi chú bàn giao gia đình (Tối thiểu 10 ký tự):</Text>
            <TextInput
              style={styles.handoverInput}
              multiline
              numberOfLines={3}
              placeholder="Dặn dò ăn uống, cữ thuốc kế tiếp, biểu hiện cần theo dõi..."
              value={handoverNote}
              onChangeText={setHandoverNote}
            />

            <View style={styles.modalRow}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowCheckOutModal(false)}
              >
                <Text style={{ color: tokens.colors.textMuted }}>Quay lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleCheckOut}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Hoàn Tất Ca</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: tokens.spacing.paddingBase,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: tokens.colors.textMain,
  },
  subtitle: {
    fontSize: 13.5,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  liveBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  sosButton: {
    backgroundColor: '#dc2626',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sosButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  extensionBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
    padding: 12,
    marginBottom: 16,
  },
  extensionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#92400e',
  },
  extensionDesc: {
    fontSize: 13,
    color: '#78350f',
    marginVertical: 4,
  },
  extensionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  extDecline: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d97706',
  },
  extDeclineText: {
    fontSize: 13,
    color: '#92400e',
  },
  extAccept: {
    backgroundColor: '#d97706',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  extAcceptText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
  },
  assessmentCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  assessmentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e40af',
  },
  assessmentDesc: {
    fontSize: 13,
    color: '#1e3a8a',
    marginVertical: 4,
  },
  assessmentLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  completedBadge: {
    backgroundColor: '#def7ec',
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
  },
  completedText: {
    fontSize: 13,
    color: '#03543f',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.textMain,
    marginBottom: 10,
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  vitalInputGroup: {
    flex: 1,
  },
  vitalLabel: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginBottom: 4,
  },
  vitalInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: '#fff',
  },
  recordVitalsBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  recordVitalsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  historyTime: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.textMain,
  },
  historyDetail: {
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  activityTitle: {
    fontSize: 14,
    color: tokens.colors.textMain,
    flex: 1,
  },
  rejectOrderBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  rejectOrderText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: tokens.colors.error,
  },
  checkoutBtn: {
    backgroundColor: tokens.colors.primary,
    height: tokens.spacing.touchTargetMin,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.textMain,
    marginBottom: 4,
  },
  modalDesc: {
    fontSize: 13,
    color: tokens.colors.textMuted,
    marginBottom: 10,
  },
  mobilityBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  mobilityActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  mismatchInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 8,
    fontSize: 13,
    marginVertical: 6,
  },
  handoverInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    height: 70,
    padding: 8,
    fontSize: 13,
    marginVertical: 6,
    textAlignVertical: 'top',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  modalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalConfirm: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
});

