import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { tokens } from '../../styles/tokens';
import { triggerSos } from '../sos/sos.api';
import {
  DEFAULT_TRAVEL_SUPPORT_VND,
  DEFAULT_SETTLEMENT_COOLING_HOURS,
  DEFAULT_RECORD_ACCESS_EXPIRY_HOURS,
} from '@healthcare-system/shared';
import { AssessmentTab } from './components/AssessmentTab';
import { VitalsTab, VitalEntry } from './components/VitalsTab';
import { CareAndPrescriptionTab, CareActivityItem } from './components/CareAndPrescriptionTab';
import { HandoverCheckoutTab } from './components/HandoverCheckoutTab';

type WorkspaceTab = 'ASSESSMENT' | 'VITALS' | 'CARE' | 'CHECKOUT';

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
  onShiftCompleted: (outcome?: { type: 'COMPLETED' | 'CANCELLED_SAFE'; note?: string }) => void;
}

export const ActiveShiftScreen: React.FC<ActiveShiftScreenProps> = ({
  bookingId,
  bookingCode,
  patientName,
  patientAge,
  patientLatitude,
  patientLongitude,
  serviceName,
  isInvasive,
  onShiftCompleted,
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('ASSESSMENT');

  // Assessment state
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);
  const [mobilityStatus, setMobilityStatus] = useState('PARTIAL');
  const [mismatchReported, setMismatchReported] = useState(false);

  // Vitals state
  const [vitalsList, setVitalsList] = useState<VitalEntry[]>([
    { id: 'v-0', time: '08:05', hr: 76, sys: 120, dia: 80, temp: 36.8, spo2: 98 },
  ]);

  // Care activities checklist
  const [activities, setActivities] = useState<CareActivityItem[]>([
    { id: '1', title: 'Đo sinh tồn ban đầu (Mạch, Huyết áp, Thân nhiệt, SpO2)', completed: true },
    { id: '2', title: 'Đối chiếu y lệnh gốc và thuốc, vật tư tại chỗ', completed: false },
    { id: '3', title: 'Thực hiện quy trình chăm sóc điều dưỡng', completed: false },
    { id: '4', title: 'Đo sinh tồn cuối ca và hướng dẫn người nhà theo dõi', completed: false },
  ]);

  // Incoming 1-hour extension request from family
  const [pendingExtension, setPendingExtension] = useState<{ hours: number; extraAmount: number } | null>({
    hours: 1,
    extraAmount: 162500,
  });

  // Zero-Latency SOS 115 Trigger
  const handleTriggerSos = () => {
    Alert.alert(
      'Gọi cấp cứu SOS 115',
      'Ứng dụng sẽ mở ngay màn hình quay số 115 và đồng thời gửi tọa độ cùng chỉ số sinh tồn mới nhất cho gia đình và điều phối viên.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gọi 115 ngay',
          style: 'destructive',
          onPress: () => {
            Linking.openURL('tel:115');
            const latest = vitalsList[0];
            triggerSos({
              bookingId,
              latitude: patientLatitude,
              longitude: patientLongitude,
              currentVitals: latest
                ? {
                    heartRate: String(latest.hr),
                    bpSystolic: String(latest.sys),
                    bpDiastolic: String(latest.dia),
                    temp: String(latest.temp),
                    spo2: String(latest.spo2),
                  }
                : undefined,
            });
          },
        },
      ]
    );
  };

  const handleSaveAssessment = ({
    mobility,
    hasMismatch,
    mismatchAction,
    reason,
  }: {
    mobility: string;
    hasMismatch: boolean;
    mismatchAction?: 'SURCHARGE' | 'STOP_NO_PENALTY';
    reason?: string;
  }) => {
    setMobilityStatus(mobility);
    setMismatchReported(hasMismatch);
    setAssessmentCompleted(true);

    if (hasMismatch && mismatchAction === 'STOP_NO_PENALTY') {
      Alert.alert(
        'Đã dừng ca an toàn',
        `Yêu cầu dừng ca do thể trạng người bệnh nặng hơn thực tế đã được ghi nhận (${reason}). Bạn không bị phạt hay trừ điểm tin cậy.`,
        [{ text: 'Đóng', onPress: () => onShiftCompleted({ type: 'CANCELLED_SAFE', note: reason }) }]
      );
      return;
    }

    Alert.alert(
      'Đã lưu đánh giá 30 phút',
      hasMismatch
        ? 'Đã gửi đề xuất phụ phí chăm sóc người bệnh nặng tới gia đình.'
        : 'Đánh giá ban đầu đã được cập nhật.'
    );
    setActiveTab('VITALS');
  };

  const handleToggleActivity = (id: string) => {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a)));
  };

  const handlePrescriptionRejected = (reason: string) => {
    Alert.alert(
      'Đã hủy ca do y lệnh không hợp lệ',
      `Ca trực đã dừng an toàn. Bạn được miễn toàn bộ phí phạt và hỗ trợ ${DEFAULT_TRAVEL_SUPPORT_VND.toLocaleString('vi-VN')}đ chi phí di chuyển.`,
      [{ text: 'Xong', onPress: () => onShiftCompleted({ type: 'CANCELLED_SAFE', note: reason }) }]
    );
  };

  const handleSubmitCheckOut = ({ handoverNote }: { finalHr: string; finalBp: string; handoverNote: string }) => {
    Alert.alert(
      'Hoàn tất ca trực',
      `Đã lưu báo cáo bàn giao. Thù lao sẽ quyết toán sau ${DEFAULT_SETTLEMENT_COOLING_HOURS} giờ và quyền xem bệnh án sẽ khóa sau ${DEFAULT_RECORD_ACCESS_EXPIRY_HOURS} giờ.`,
      [{ text: 'Xong', onPress: () => onShiftCompleted({ type: 'COMPLETED', note: handoverNote }) }]
    );
  };

  const completedActivitiesCount = activities.filter((a) => a.completed).length;

  return (
    <View style={styles.root}>
      {/* Sticky Top Header + SOS Bar */}
      <View style={styles.topHeader}>
        <View style={styles.headerMeta}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerPatient} numberOfLines={1}>
              {patientName} ({patientAge} tuổi)
            </Text>
            <Text style={styles.headerService} numberOfLines={1}>
              {bookingCode} · {serviceName}
            </Text>
          </View>

          <TouchableOpacity style={styles.sosBtn} onPress={handleTriggerSos}>
            <Text style={styles.sosBtnText}>SOS 115</Text>
          </TouchableOpacity>
        </View>

        {/* 4-Tab Clinical Navigation */}
        <View style={styles.tabBar}>
          {[
            { key: 'ASSESSMENT' as const, label: 'Sàng lọc 30p', dot: !assessmentCompleted },
            { key: 'VITALS' as const, label: 'Sinh tồn', dot: false },
            { key: 'CARE' as const, label: 'Chăm sóc', dot: false },
            { key: 'CHECKOUT' as const, label: 'Bàn giao', dot: false },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, active && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tab.dot && <View style={styles.pendingDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Scrollable Workspace Content */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Extension Request Banner */}
        {pendingExtension && (
          <View style={styles.extensionBanner}>
            <Text style={styles.extensionTitle}>
              Gia đình đề nghị gia hạn thêm {pendingExtension.hours} giờ (+{pendingExtension.extraAmount.toLocaleString('vi-VN')} đ)
            </Text>
            <Text style={styles.extensionSub}>
              Kiểm tra lịch kế tiếp của bạn trước khi xác nhận làm thêm giờ.
            </Text>
            <View style={styles.extensionActions}>
              <TouchableOpacity
                style={styles.extDeclineBtn}
                onPress={() => {
                  setPendingExtension(null);
                  Alert.alert('Đã phản hồi', 'Bạn đã từ chối yêu cầu gia hạn ca.');
                }}
              >
                <Text style={styles.extDeclineText}>Từ chối</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.extAcceptBtn}
                onPress={() => {
                  setPendingExtension(null);
                  Alert.alert('Đã đồng ý gia hạn', `Ca trực được cộng thêm ${pendingExtension.hours} giờ.`);
                }}
              >
                <Text style={styles.extAcceptText}>Đồng ý thêm 1 giờ</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'ASSESSMENT' && (
          <AssessmentTab
            completed={assessmentCompleted}
            mobility={mobilityStatus}
            mismatchReported={mismatchReported}
            onSaveAssessment={handleSaveAssessment}
          />
        )}

        {activeTab === 'VITALS' && (
          <VitalsTab
            vitalsList={vitalsList}
            onAddVitals={(entry) => setVitalsList((prev) => [entry, ...prev])}
          />
        )}

        {activeTab === 'CARE' && (
          <CareAndPrescriptionTab
            activities={activities}
            isInvasive={isInvasive}
            onToggleActivity={handleToggleActivity}
            onPrescriptionRejected={handlePrescriptionRejected}
          />
        )}

        {activeTab === 'CHECKOUT' && (
          <HandoverCheckoutTab
            assessmentCompleted={assessmentCompleted}
            completedActivitiesCount={completedActivitiesCount}
            totalActivitiesCount={activities.length}
            onSubmitCheckOut={handleSubmitCheckOut}
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  topHeader: {
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerPatient: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  headerService: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  sosBtn: {
    backgroundColor: tokens.colors.alertCrimson,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    gap: 5,
  },
  tabItemActive: {
    borderBottomColor: tokens.colors.brandJade,
  },
  tabLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  tabLabelActive: {
    color: tokens.colors.brandJade,
    fontWeight: '700',
  },
  pendingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: tokens.colors.accentOchre,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  extensionBanner: {
    backgroundColor: tokens.colors.accentOchreSoft,
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  extensionTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 3,
  },
  extensionSub: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginBottom: 10,
  },
  extensionActions: {
    flexDirection: 'row',
    gap: 10,
  },
  extDeclineBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: tokens.colors.paper,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extDeclineText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  extAcceptBtn: {
    flex: 2,
    height: 42,
    borderRadius: 10,
    backgroundColor: tokens.colors.accentOchre,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extAcceptText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
