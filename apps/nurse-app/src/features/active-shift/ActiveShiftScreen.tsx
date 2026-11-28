import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MessageSquare } from 'lucide-react-native';
import { tokens } from '../../styles/tokens';
import { SosButton } from '../sos/SosButton';
import { getConversation, subscribeConversation } from '../chat/chat.api';
import { CHAT_LABELS } from '../chat/chat-labels';
import { countUnreadMessages } from '../chat/useConversation';
import {
  getShiftExecutionState,
  submitInitialAssessment,
  addVitalSigns as submitVitalSigns,
  toggleCareActivity,
  respondToExtension,
  rejectInvalidPrescription,
  submitCheckOut,
  executeQueuedShiftAction,
  PendingExtensionDto,
} from './active-shift.api';
import {
  subscribeQueue,
  setupQueueAutoSync,
  processQueue,
  getPendingQueueCount,
  isNetworkConnected,
} from './offline-queue';
import { shiftRealtime, type ExtensionRequestPayload } from '../../lib/realtime';
import { DeviceGeoCoords, IS_DEV } from '../../lib/hardware-providers';
import {
  DEFAULT_TRAVEL_SUPPORT_VND,
  DEFAULT_SETTLEMENT_COOLING_HOURS,
  DEFAULT_RECORD_ACCESS_EXPIRY_HOURS,
  DEFAULT_PLATFORM_COMMISSION_RATE,
} from '@healthcare-system/shared';
import { addCashCommissionDebtMock } from '../commission-payment/commission-payment.api';
import { AssessmentTab } from './components/AssessmentTab';
import { VitalsTab, VitalEntry } from './components/VitalsTab';
import { CareAndPrescriptionTab, CareActivityItem } from './components/CareAndPrescriptionTab';
import { HandoverCheckoutTab } from './components/HandoverCheckoutTab';

type WorkspaceTab = 'ASSESSMENT' | 'VITALS' | 'CARE' | 'CHECKOUT';

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
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
  bookingAmount?: number;
  onPayCommissionNow?: (bookingId: string) => void;
  onOpenDispute?: (bookingId: string) => void;
  onOpenChat?: (bookingId: string) => void;
  unreadChatCount?: number;
  onRequestCurrentPosition?: () => Promise<DeviceGeoCoords>;
  onCaptureLivePhoto?: () => Promise<string | null>;
  onShiftCompleted: (outcome?: { type: 'COMPLETED' | 'CANCELLED_SAFE'; note?: string }) => void;
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
  paymentMethod = 'CASH',
  bookingAmount = 500000,
  onPayCommissionNow,
  onOpenDispute,
  onOpenChat,
  unreadChatCount,
  onRequestCurrentPosition,
  onCaptureLivePhoto,
  onShiftCompleted,
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('ASSESSMENT');

  // Network and offline queue states
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [syncingQueue, setSyncingQueue] = useState<boolean>(false);

  // Assessment state
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);
  const [mobilityStatus, setMobilityStatus] = useState('PARTIAL');
  const [mismatchReported, setMismatchReported] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);

  // Vitals state
  const [vitalsList, setVitalsList] = useState<VitalEntry[]>(
    IS_DEV
      ? [{ id: 'v-0', time: '08:05', hr: 76, sys: 120, dia: 80, temp: 36.8, spo2: 98 }]
      : []
  );

  // Care activities checklist
  const [activities, setActivities] = useState<CareActivityItem[]>(DEFAULT_CARE_ACTIVITIES);
  const [rejectingRx, setRejectingRx] = useState(false);

  // Extension request loaded from server or realtime WebSocket
  const [pendingExtension, setPendingExtension] = useState<PendingExtensionDto | null>(null);
  const [extensionSubmitting, setExtensionSubmitting] = useState(false);

  // Check-out state
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  // Chat unread count
  const [fetchedChatUnread, setFetchedChatUnread] = useState(0);

  useEffect(() => {
    if (unreadChatCount !== undefined || !bookingId) return;
    let alive = true;
    let unsub: (() => void) | undefined;

    void getConversation(bookingId).then((res) => {
      if (!alive || !res.success || !res.data) return;
      setFetchedChatUnread(countUnreadMessages(res.data.messages));
      unsub = subscribeConversation(res.data.id, (msg) => {
        if (msg.senderRole !== 'NURSE' && !msg.readAt) {
          setFetchedChatUnread((prev) => prev + 1);
        }
      });
    });

    return () => {
      alive = false;
      if (unsub) unsub();
    };
  }, [bookingId, unreadChatCount]);

  const effectiveChatUnread = unreadChatCount ?? fetchedChatUnread;

  // 1. Initial State Loading from Server
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
        // Fallback to local state if server is not reachable
      });

    return () => {
      alive = false;
    };
  }, [bookingId]);

  // 2. Realtime WebSocket for Shift Updates (e.g. extension requests from customer)
  useEffect(() => {
    shiftRealtime.connect(bookingId);

    const unsubExtension = shiftRealtime.subscribe<ExtensionRequestPayload>(
      'EXTENSION_REQUESTED',
      (payload) => {
        setPendingExtension({
          id: payload.extensionId,
          hours: payload.hours,
          extraAmount: payload.extraAmount,
        });
      }
    );

    return () => {
      unsubExtension();
      shiftRealtime.disconnect();
    };
  }, [bookingId]);

  // 3. Network Monitoring & Offline Queue Subscription
  useEffect(() => {
    void isNetworkConnected().then(setIsOnline);
    void getPendingQueueCount(bookingId).then(setPendingQueueCount);

    const unsubNetInfo = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
    });

    const unsubQueue = subscribeQueue((queue) => {
      const shiftItems = queue.filter((item) => item.bookingId === bookingId);
      setPendingQueueCount(shiftItems.length);
    });

    const unsubAutoSync = setupQueueAutoSync(executeQueuedShiftAction, bookingId);

    return () => {
      unsubNetInfo();
      unsubQueue();
      unsubAutoSync();
    };
  }, [bookingId]);

  const handleManualSync = async () => {
    setSyncingQueue(true);
    try {
      const res = await processQueue(executeQueuedShiftAction, bookingId);
      if (res.processed > 0) {
        Alert.alert('Đồng bộ thành công', `Đã gửi thành công ${res.processed} mục lên máy chủ.`);
      } else if (res.remaining > 0) {
        Alert.alert('Đồng bộ chưa hoàn tất', `Còn ${res.remaining} mục chưa thể gửi. Vui lòng thử lại sau.`);
      }
    } finally {
      setSyncingQueue(false);
    }
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

      if (res.isOfflineQueued) {
        Alert.alert(
          'Đã lưu đánh giá (Ngoại tuyến)',
          'Đánh giá ban đầu đã được lưu vào thiết bị và sẽ tự động gửi lên hệ thống khi có mạng.'
        );
      } else {
        Alert.alert(
          'Đã lưu đánh giá 30 phút',
          hasMismatch
            ? 'Đã gửi đề xuất phụ phí chăm sóc người bệnh nặng tới gia đình.'
            : 'Đánh giá ban đầu đã được cập nhật lên hệ thống.'
        );
      }
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

      if (res.isOfflineQueued) {
        Alert.alert(
          'Đã lưu sinh tồn (Ngoại tuyến)',
          'Dữ liệu chỉ số sinh tồn đã được lưu vào hàng đợi thiết bị và sẽ tự động gửi khi có kết nối mạng.'
        );
      }

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

      if (paymentMethod === 'CASH') {
        const commAmt = Math.floor((bookingAmount || 500000) * DEFAULT_PLATFORM_COMMISSION_RATE);
        void addCashCommissionDebtMock(
          bookingId,
          bookingCode,
          serviceName,
          bookingAmount || 500000
        );

        Alert.alert(
          'Hoàn tất ca trực tiền mặt',
          `Khách trả tiền mặt ${(bookingAmount || 500000).toLocaleString('vi-VN')}đ — nộp ${commAmt.toLocaleString('vi-VN')}đ hoa hồng trong 24 giờ.`,
          [
            {
              text: 'Nộp hoa hồng ngay',
              onPress: () => {
                if (onPayCommissionNow) {
                  onPayCommissionNow(bookingId);
                } else {
                  onShiftCompleted({ type: 'COMPLETED', note: handoverNote });
                }
              },
            },
            {
              text: 'Để sau và về trang chủ',
              style: 'cancel',
              onPress: () => onShiftCompleted({ type: 'COMPLETED', note: handoverNote }),
            },
          ]
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

  const getLatestVitalsRecord = () => {
    const latest = vitalsList[0];
    if (!latest) return undefined;
    return {
      heartRate: String(latest.hr),
      bpSystolic: String(latest.sys),
      bpDiastolic: String(latest.dia),
      temp: String(latest.temp),
      spo2: String(latest.spo2),
    };
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

          {/* Unified Zero-Latency SOS Button */}
          <View style={styles.headerActions}>
            {onOpenChat ? (
              <TouchableOpacity
                style={styles.chatBtn}
                onPress={() => onOpenChat(bookingId)}
                accessibilityRole="button"
                accessibilityLabel={CHAT_LABELS.chatActionButton}
              >
                <MessageSquare size={15} color={tokens.colors.brandJadeDark} />
                <Text style={styles.chatBtnText}>{CHAT_LABELS.chatActionButton}</Text>
                {effectiveChatUnread > 0 ? (
                  <View style={styles.chatUnreadBadge}>
                    <Text style={styles.chatUnreadText}>
                      {effectiveChatUnread > 99 ? '99+' : effectiveChatUnread}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ) : null}
            {onOpenDispute ? (
              <TouchableOpacity
                style={styles.disputeBtn}
                onPress={() => onOpenDispute(bookingId)}
                accessibilityRole="button"
                accessibilityLabel="Mở khiếu nại ca trực"
              >
                <Text style={styles.disputeBtnText}>Khiếu nại</Text>
              </TouchableOpacity>
            ) : null}
            <SosButton
              bookingId={bookingId}
              patientLatitude={patientLatitude}
              patientLongitude={patientLongitude}
              onRequestCurrentPosition={onRequestCurrentPosition}
              getLatestVitals={getLatestVitalsRecord}
            />
          </View>
        </View>

        {/* Offline Queue Status Banner */}
        {(!isOnline || pendingQueueCount > 0) && (
          <View
            style={[
              styles.offlineBanner,
              !isOnline ? styles.offlineBannerOffline : styles.offlineBannerSyncing,
            ]}
          >
            <Text style={styles.offlineText}>
              {!isOnline
                ? `Đang ngoại tuyến — ${pendingQueueCount} mục chờ gửi`
                : `Có mạng trở lại — ${pendingQueueCount} mục chờ đồng bộ`}
            </Text>
            {isOnline && pendingQueueCount > 0 && (
              <TouchableOpacity
                style={styles.syncNowBtn}
                onPress={handleManualSync}
                disabled={syncingQueue}
              >
                <Text style={styles.syncNowText}>
                  {syncingQueue ? 'Đang gửi...' : 'Gửi ngay'}
                </Text>
              </TouchableOpacity>
            )}
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
        {/* Real-time Extension Request Banner */}
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
              shiftRealtime.simulateEvent('EXTENSION_REQUESTED', {
                extensionId: `ext-${Date.now()}`,
                hours: 1,
                extraAmount: 162500,
              })
            }
          >
            <Text style={styles.devExtTriggerText}>
              [DEV] Mô phỏng WebSocket khách gửi yêu cầu gia hạn 1 giờ
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
            paymentMethod={paymentMethod}
            bookingAmount={bookingAmount}
            bookingCode={bookingCode}
            bookingId={bookingId}
            onPayCommissionNow={onPayCommissionNow}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disputeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.alertCrimson,
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  disputeBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.alertCrimson,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.brandJade,
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  chatBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
  },
  chatUnreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: tokens.colors.alertCrimson,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatUnreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.paper,
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
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  offlineBannerOffline: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  offlineBannerSyncing: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  offlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
    flex: 1,
  },
  syncNowBtn: {
    backgroundColor: tokens.colors.brandJade,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  syncNowText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
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
    backgroundColor: tokens.colors.brandJadeSoft,
    borderRadius: 8,
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
  devExtTrigger: {
    marginBottom: 12,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  devExtTriggerText: {
    fontSize: 13,
    color: tokens.colors.inkMuted,
    textDecorationLine: 'underline',
  },
});
