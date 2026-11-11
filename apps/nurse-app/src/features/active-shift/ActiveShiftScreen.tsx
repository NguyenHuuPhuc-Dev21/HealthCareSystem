import React, { useEffect, useState } from 'react';
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
  getShiftExecutionState,
  submitInitialAssessment,
  addVitalSigns as submitVitalSigns,
  toggleCareActivity,
  respondToExtension,
  rejectInvalidPrescription,
  submitCheckOut,
  PendingExtensionDto,
} from './active-shift.api';
import { DeviceGeoCoords, IS_DEV } from '../../lib/hardware-providers';
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
type SosStatus = 'idle' | 'sending' | 'sent' | 'failed';

const DEFAULT_CARE_ACTIVITIES: CareActivityItem[] = [
  { id: '1', title: 'Đo sinh tồn ban đầu (Mạch, Huyết áp, Thân nhiệt, SpO2)', completed: false },
  { id: '2', title: 'Đối chiếu y lệnh gốc và thuốc, vật tư tại chỗ', completed: false },
  { id: '3', title: 'Thực hiện quy trình chăm sóc điều dưỡng', completed: false },
  { id: '4', title: 'Đo sinh tồn cuối ca và hướng dẫn người nhà theo dõi', completed: false },
];

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
  onRequestCurrentPosition?: () => Promise<DeviceGeoCoords>;
  onCaptureLivePhoto?: () => Promise<string | null>;
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
  onRequestCurrentPosition,
  onCaptureLivePhoto,
  onShiftCompleted,
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('ASSESSMENT');

  // Assessment state
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);
  const [mobilityStatus, setMobilityStatus] = useState('PARTIAL');
  const [mismatchReported, setMismatchReported] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);

  // Vitals state (seeded only in DEV preview; real sessions load from server)
  const [vitalsList, setVitalsList] = useState<VitalEntry[]>(
    IS_DEV
      ? [{ id: 'v-0', time: '08:05', hr: 76, sys: 120, dia: 80, temp: 36.8, spo2: 98 }]
      : []
  );

  // Care activities checklist
  const [activities, setActivities] = useState<CareActivityItem[]>(DEFAULT_CARE_ACTIVITIES);
  const [rejectingRx, setRejectingRx] = useState(false);

  // Extension request loaded from server (never hardcoded on real shifts)
  const [pendingExtension, setPendingExtension] = useState<PendingExtensionDto | null>(null);
  const [extensionSubmitting, setExtensionSubmitting] = useState(false);

  // SOS dispatch state
  const [sosStatus, setSosStatus] = useState<SosStatus>('idle');
  const [sosError, setSosError] = useState<string | null>(null);

  // Check-out state
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  useEffect(() => {
    let alive = true;
    getShiftExecutionState(bookingId)
      .then((res) => {
        if (!alive || !res.success || !res.data) return;
        const data = res.data;
        if (typeof data.assessmentCompleted === 'boolean') {
          setAssessmentCompleted(data.assessmentCompleted);
        }
        if (data.mobilityStatus) {
          setMobilityStatus(data.mobilityStatus);
        }
        if (typeof data.mismatchReported === 'boolean') {
          setMismatchReported(data.mismatchReported);
        }
        if (data.pendingExtension !== undefined) {
          setPendingExtension(data.pendingExtension);
        }
        if (Array.isArray(data.careActivities) && data.careActivities.length > 0) {
          setActivities(data.careActivities);
        }
        if (Array.isArray(data.vitalSigns)) {
          setVitalsList(
            data.vitalSigns.map((v, idx) => ({
              id: v.id || `srv-${idx}`,
              time: v.timestamp || '--:--',
              hr: v.heartRate,
              sys: v.bloodPressureSystolic,
              dia: v.bloodPressureDiastolic,
              temp: v.temperature,
              spo2: v.spo2,
            }))
          );
        }
      })
      .catch(() => {
        // Giữ trạng thái cục bộ ban đầu nếu chưa đồng bộ được từ máy chủ
      });

    return () => {
      alive = false;
    };
  }, [bookingId]);

  const executeSosDispatch = async () => {
    setSosStatus('sending');
    setSosError(null);

    let lat = patientLatitude;
    let lng = patientLongitude;
    if (onRequestCurrentPosition) {
      try {
        const coords = await onRequestCurrentPosition();
        lat = coords.latitude;
        lng = coords.longitude;
      } catch {
        // Fallback sang tọa độ ca trực nếu cảm biến GPS bận
      }
    }

    const latest = vitalsList[0];
    try {
      const res = await triggerSos({
        bookingId,
        latitude: lat,
        longitude: lng,
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

      if (res.success) {
        setSosStatus('sent');
        Alert.alert(
          'Đã phát tín hiệu SOS',
          'Tọa độ GPS và chỉ số sinh tồn mới nhất đã được gửi tới điều phối viên và gia đình người bệnh.'
        );
      } else {
        const msg = res.error?.message || 'Máy chủ chưa xác nhận cảnh báo SOS.';
        setSosStatus('failed');
        setSosError(msg);
        Alert.alert('Chưa gửi được cảnh báo SOS', msg, [
          { text: 'Đóng', style: 'cancel' },
          { text: 'Thử gửi lại', onPress: () => void executeSosDispatch() },
        ]);
      }
    } catch {
      const msg = 'Lỗi kết nối mạng khi gửi tọa độ và chỉ số sinh tồn khẩn cấp.';
      setSosStatus('failed');
      setSosError(msg);
      Alert.alert('Chưa gửi được cảnh báo SOS', msg, [
        { text: 'Đóng', style: 'cancel' },
        { text: 'Thử gửi lại', onPress: () => void executeSosDispatch() },
      ]);
    }
  };

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
            void Linking.openURL('tel:115').catch(() => {});
            void executeSosDispatch();
          },
        },
      ]
    );
  };

  const handleRespondExtension = async (approved: boolean) => {
    if (!pendingExtension || extensionSubmitting) return;
    setExtensionSubmitting(true);
    try {
      const res = await respondToExtension(bookingId, pendingExtension.id, approved);
      if (res.success) {
        const acceptedHours = pendingExtension.hours;
        setPendingExtension(null);
        Alert.alert(
          approved ? 'Đã đồng ý gia hạn' : 'Đã phản hồi',
          approved
            ? `Ca trực được cộng thêm ${acceptedHours} giờ.`
            : 'Bạn đã từ chối yêu cầu gia hạn ca.'
        );
      } else {
        Alert.alert(
          'Không thể gửi phản hồi',
          res.error?.message || 'Vui lòng kiểm tra kết nối và thử lại.'
        );
      }
    } catch {
      Alert.alert('Lỗi kết nối', 'Không thể gửi phản hồi gia hạn tới máy chủ. Vui lòng thử lại.');
    } finally {
      setExtensionSubmitting(false);
    }
  };

  const handleSaveAssessment = async ({
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
    setSavingAssessment(true);
    try {
      const res = await submitInitialAssessment(bookingId, {
        actualMobility: mobility,
        mentalStatus: 'Tỉnh táo, tiếp xúc tốt',
        isConditionMatched: !hasMismatch,
        mismatchReason: reason,
        requestedAction:
          mismatchAction === 'STOP_NO_PENALTY'
            ? 'REFUSE'
            : mismatchAction === 'SURCHARGE'
            ? 'SURCHARGE'
            : undefined,
      });

      if (!res.success) {
        Alert.alert(
          'Không thể lưu đánh giá',
          res.error?.message || 'Máy chủ từ chối lưu đánh giá 30 phút. Vui lòng thử lại.'
        );
        return;
      }

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
          : 'Đánh giá ban đầu đã được cập nhật lên hệ thống.'
      );
      setActiveTab('VITALS');
    } catch {
      Alert.alert('Lỗi kết nối', 'Không thể gửi đánh giá 30 phút lên máy chủ. Vui lòng thử lại.');
    } finally {
      setSavingAssessment(false);
    }
  };

  const handleAddVitals = async (entry: VitalEntry): Promise<boolean> => {
    try {
      const res = await submitVitalSigns(bookingId, {
        timestamp: entry.time,
        heartRate: entry.hr,
        bloodPressureSystolic: entry.sys,
        bloodPressureDiastolic: entry.dia,
        temperature: entry.temp,
        spo2: entry.spo2,
      });
      if (!res.success) {
        Alert.alert(
          'Không thể lưu sinh tồn',
          res.error?.message || 'Máy chủ chưa lưu được chỉ số sinh tồn. Vui lòng thử lại.'
        );
        return false;
      }
      setVitalsList((prev) => [entry, ...prev]);
      return true;
    } catch {
      Alert.alert('Lỗi kết nối', 'Chưa gửi được chỉ số sinh tồn lên hệ thống. Vui lòng thử lại.');
      return false;
    }
  };

  const handleToggleActivity = async (id: string) => {
    const target = activities.find((a) => a.id === id);
    if (!target) return;
    const nextCompleted = !target.completed;

    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, completed: nextCompleted } : a))
    );

    try {
      const res = await toggleCareActivity(bookingId, id, nextCompleted);
      if (!res.success) {
        setActivities((prev) =>
          prev.map((a) => (a.id === id ? { ...a, completed: target.completed } : a))
        );
        Alert.alert(
          'Chưa cập nhật được mục chăm sóc',
          res.error?.message || 'Vui lòng kiểm tra kết nối và thử lại.'
        );
      }
    } catch {
      setActivities((prev) =>
        prev.map((a) => (a.id === id ? { ...a, completed: target.completed } : a))
      );
      Alert.alert('Lỗi kết nối', 'Không thể đồng bộ trạng thái quy trình chăm sóc lên máy chủ.');
    }
  };

  const handlePrescriptionRejected = async ({
    reason,
    evidencePhotoUri,
  }: {
    reason: string;
    evidencePhotoUri: string;
  }) => {
    setRejectingRx(true);
    try {
      const res = await rejectInvalidPrescription(bookingId, { reason, evidencePhotoUri });
      if (!res.success) {
        Alert.alert(
          'Chưa gửi được báo cáo y lệnh',
          res.error?.message || 'Vui lòng thử lại hoặc liên hệ điều phối viên.'
        );
        return;
      }
      Alert.alert(
        'Đã hủy ca do y lệnh không hợp lệ',
        `Ca trực đã dừng an toàn. Bạn được miễn toàn bộ phí phạt và hỗ trợ ${DEFAULT_TRAVEL_SUPPORT_VND.toLocaleString('vi-VN')}đ chi phí di chuyển.`,
        [{ text: 'Xong', onPress: () => onShiftCompleted({ type: 'CANCELLED_SAFE', note: reason }) }]
      );
    } catch {
      Alert.alert('Lỗi kết nối', 'Không thể gửi báo cáo từ chối y lệnh lên máy chủ.');
    } finally {
      setRejectingRx(false);
    }
  };

  const handleSubmitCheckOut = async ({
    finalHr,
    finalBp,
    handoverNote,
  }: {
    finalHr: string;
    finalBp: string;
    handoverNote: string;
  }) => {
    const [rawSys, rawDia] = finalBp.split('/').map((part) => Number(part.trim()));
    const latest = vitalsList[0];
    setSubmittingCheckout(true);
    try {
      const res = await submitCheckOut(bookingId, {
        checkoutTime: new Date().toISOString(),
        finalVitals: {
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          heartRate: Number(finalHr),
          bloodPressureSystolic: rawSys || 120,
          bloodPressureDiastolic: rawDia || 80,
          temperature: latest?.temp || 36.8,
          spo2: latest?.spo2 || 98,
        },
        completedActivityIds: activities.filter((a) => a.completed).map((a) => a.id),
        handoverNote,
      });

      if (!res.success) {
        Alert.alert(
          'Chưa hoàn tất check-out',
          res.error?.message || 'Không thể lưu báo cáo bàn giao lên hệ thống. Vui lòng thử lại.'
        );
        return;
      }

      Alert.alert(
        'Hoàn tất ca trực',
        `Đã lưu báo cáo bàn giao lên hệ thống. Thù lao sẽ quyết toán sau ${DEFAULT_SETTLEMENT_COOLING_HOURS} giờ và quyền xem bệnh án sẽ khóa sau ${DEFAULT_RECORD_ACCESS_EXPIRY_HOURS} giờ.`,
        [{ text: 'Xong', onPress: () => onShiftCompleted({ type: 'COMPLETED', note: handoverNote }) }]
      );
    } catch {
      Alert.alert('Lỗi kết nối', 'Chưa gửi được báo cáo bàn giao. Vui lòng thử lại.');
    } finally {
      setSubmittingCheckout(false);
    }
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

          <TouchableOpacity
            style={[styles.sosBtn, sosStatus === 'sending' && { opacity: 0.7 }]}
            disabled={sosStatus === 'sending'}
            onPress={handleTriggerSos}
          >
            <Text style={styles.sosBtnText}>
              {sosStatus === 'sending' ? 'Đang gửi...' : 'SOS 115'}
            </Text>
          </TouchableOpacity>
        </View>

        {sosStatus === 'failed' && (
          <View style={styles.sosAlertBanner}>
            <Text style={styles.sosAlertText}>
              Chưa gửi được cảnh báo GPS/sinh tồn: {sosError || 'Lỗi kết nối.'}
            </Text>
            <View style={styles.sosAlertActions}>
              <TouchableOpacity
                style={styles.sosRetryBtn}
                onPress={() => void executeSosDispatch()}
              >
                <Text style={styles.sosRetryText}>Thử gửi lại cảnh báo GPS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sosDialBtn}
                onPress={() => void Linking.openURL('tel:115').catch(() => {})}
              >
                <Text style={styles.sosDialText}>Gọi 115</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {sosStatus === 'sent' && (
          <View style={styles.sosSentBanner}>
            <Text style={styles.sosSentText}>
              Đã gửi cảnh báo SOS kèm tọa độ và sinh tồn tới điều phối viên.
            </Text>
          </View>
        )}

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
                style={[styles.extDeclineBtn, extensionSubmitting && { opacity: 0.6 }]}
                disabled={extensionSubmitting}
                onPress={() => void handleRespondExtension(false)}
              >
                <Text style={styles.extDeclineText}>Từ chối</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.extAcceptBtn, extensionSubmitting && { opacity: 0.6 }]}
                disabled={extensionSubmitting}
                onPress={() => void handleRespondExtension(true)}
              >
                <Text style={styles.extAcceptText}>
                  {extensionSubmitting ? 'Đang gửi...' : `Đồng ý thêm ${pendingExtension.hours} giờ`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {IS_DEV && !pendingExtension && (
          <TouchableOpacity
            style={styles.devExtTrigger}
            onPress={() =>
              setPendingExtension({ id: 'dev-ext-1', hours: 1, extraAmount: 162500 })
            }
          >
            <Text style={styles.devExtTriggerText}>
              [DEV] Mô phỏng nhận yêu cầu gia hạn 1 giờ từ gia đình
            </Text>
          </TouchableOpacity>
        )}

        {activeTab === 'ASSESSMENT' && (
          <AssessmentTab
            completed={assessmentCompleted}
            mobility={mobilityStatus}
            mismatchReported={mismatchReported}
            saving={savingAssessment}
            onSaveAssessment={handleSaveAssessment}
          />
        )}

        {activeTab === 'VITALS' && (
          <VitalsTab vitalsList={vitalsList} onAddVitals={handleAddVitals} />
        )}

        {activeTab === 'CARE' && (
          <CareAndPrescriptionTab
            activities={activities}
            isInvasive={isInvasive}
            rejecting={rejectingRx}
            onCaptureEvidencePhoto={onCaptureLivePhoto}
            onToggleActivity={handleToggleActivity}
            onPrescriptionRejected={handlePrescriptionRejected}
          />
        )}

        {activeTab === 'CHECKOUT' && (
          <HandoverCheckoutTab
            assessmentCompleted={assessmentCompleted}
            completedActivitiesCount={completedActivitiesCount}
            totalActivitiesCount={activities.length}
            submitting={submittingCheckout}
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
  sosAlertBanner: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  sosAlertText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.alertCrimson,
    marginBottom: 8,
  },
  sosAlertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  sosRetryBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: tokens.colors.alertCrimson,
    alignItems: 'center',
  },
  sosRetryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sosDialBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: tokens.colors.paper,
    borderWidth: 1,
    borderColor: tokens.colors.alertCrimson,
    alignItems: 'center',
  },
  sosDialText: {
    color: tokens.colors.alertCrimson,
    fontSize: 13,
    fontWeight: '700',
  },
  sosSentBanner: {
    marginBottom: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  sosSentText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.brandJade,
  },
  devExtTrigger: {
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colors.accentOchre,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
  },
  devExtTriggerText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.accentOchre,
  },
});
