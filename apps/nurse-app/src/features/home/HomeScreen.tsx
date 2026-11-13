import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CHECKIN_MAX_RADIUS_METERS,
  type MobileShiftSummary,
} from '@healthcare-system/shared';
import { AppButton, StateView, StatusBadge } from '../../components';
import { getMyShifts } from '../active-shift/active-shift.api';
import {
  getHardwareCapabilityStatus,
  IS_DEV,
  type DeviceGeoCoords,
} from '../../lib/hardware-providers';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList, MainTabParamList } from '../../navigation/types';

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'HomeTab'>,
  NativeStackNavigationProp<ActiveStackParamList>
>;

interface HomeScreenProps {
  navigation: HomeNavProp;
  initialShift?: MobileShiftSummary;
  onRequestCurrentPosition?: () => Promise<DeviceGeoCoords>;
  onCaptureLivePhoto?: () => Promise<string | null>;
}

export const DEV_SAMPLE_SHIFT: MobileShiftSummary = {
  bookingId: 'job-1',
  bookingCode: 'BK-20261102-001',
  patientName: 'Bà Nguyễn Thị Mai',
  patientAge: 78,
  patientAddress: 'Số 25 Quang Trung, Hải Châu, Đà Nẵng',
  patientLatitude: 16.0718,
  patientLongitude: 108.2205,
  serviceName: 'Chăm sóc vết loét độ 3 và thay băng',
  timeRange: '08:00 – 12:00 hôm nay',
  mobilityNote: 'Nằm tại giường, cần hỗ trợ xoay trở nhẹ nhàng',
  allergies: 'Dị ứng kháng sinh nhóm Penicillin',
  isInvasive: true,
  prescriptionSummary:
    'Đơn thuốc ngày 26/10/2026: Dung dịch sát khuẩn vết loét Povidone Iodine 10%, gạc vô khuẩn và băng ép chuyên dụng.',
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  navigation,
  initialShift,
  onRequestCurrentPosition,
  onCaptureLivePhoto,
}) => {
  const [activeShift, setActiveShift] = useState<MobileShiftSummary | null>(
    initialShift ?? (IS_DEV ? DEV_SAMPLE_SHIFT : null)
  );
  const [loadingShift, setLoadingShift] = useState<boolean>(!initialShift);
  const [shiftLoadError, setShiftLoadError] = useState<string | null>(null);

  const hardwareStatus = useMemo(
    () => getHardwareCapabilityStatus({ onRequestCurrentPosition, onCaptureLivePhoto }),
    [onRequestCurrentPosition, onCaptureLivePhoto]
  );

  const loadAssignedShift = useCallback(async () => {
    if (initialShift) return;
    setLoadingShift(true);
    setShiftLoadError(null);
    try {
      const res = await getMyShifts();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setActiveShift(res.data[0]);
      } else if (!res.success && !IS_DEV) {
        setShiftLoadError(res.error?.message || 'Không thể tải danh sách ca trực hôm nay.');
      }
    } catch {
      if (!IS_DEV) {
        setShiftLoadError('Lỗi kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.');
      }
    } finally {
      setLoadingShift(false);
    }
  }, [initialShift]);

  useEffect(() => {
    void loadAssignedShift();
  }, [loadAssignedShift]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.homeHead}>
          <Text style={styles.brandMark}>CareNest</Text>
          <Text style={styles.title}>Lịch trực hôm nay</Text>
          <Text style={styles.subtitle}>
            Kiểm tra hồ sơ người bệnh, điểm danh tại nhà và ghi nhận chăm sóc lâm sàng.
          </Text>
        </View>

        {!IS_DEV && !hardwareStatus.isReadyForRelease && (
          <View style={styles.hardwareWarnBox}>
            <Text style={styles.hardwareWarnText}>
              {!hardwareStatus.hasCameraProvider && !hardwareStatus.hasLocationProvider
                ? 'Thiếu kết nối Camera và GPS phần cứng cho thao tác điểm danh thực tế.'
                : !hardwareStatus.hasCameraProvider
                ? 'Thiếu kết nối Camera phần cứng để chụp ảnh selfie điểm danh.'
                : 'Thiếu kết nối cảm biến GPS thiết bị.'}
            </Text>
          </View>
        )}

        {loadingShift && !activeShift ? (
          <StateView kind="loading" title="Đang tải ca trực hôm nay" />
        ) : shiftLoadError ? (
          <StateView
            kind="error"
            title="Không thể tải lịch trực"
            message={shiftLoadError}
            actionLabel="Thử lại"
            onAction={() => void loadAssignedShift()}
          />
        ) : !activeShift ? (
          <StateView
            kind="empty"
            title="Hôm nay bạn chưa có ca trực nào"
            message="Vui lòng nhận ca trên Bảng việc làm để bắt đầu thực hiện chăm sóc tại nhà."
            actionLabel="Mở Bảng việc làm"
            onAction={() => navigation.navigate('JobsTab')}
          />
        ) : (
          <View style={styles.anchorCard}>
            <View style={styles.badgeRow}>
              <StatusBadge
                label={IS_DEV ? '[DEV] Đã xác nhận' : 'Đã xác nhận'}
                tone="jade"
              />
              <Text style={styles.timeText}>{activeShift.timeRange}</Text>
            </View>

            <Text style={styles.serviceName}>{activeShift.serviceName}</Text>
            <Text style={styles.patientInfo}>
              Người bệnh: {activeShift.patientName} ({activeShift.patientAge} tuổi)
            </Text>
            <Text style={styles.addressInfo}>{activeShift.patientAddress}</Text>

            <View style={styles.cardActions}>
              <AppButton
                label="Xem hồ sơ ca"
                variant="secondary"
                onPress={() => navigation.navigate('ShiftBriefing', { shift: activeShift })}
                style={styles.briefingBtn}
              />
              <AppButton
                label="Điểm danh vào ca"
                disabled={!IS_DEV && !hardwareStatus.isReadyForRelease}
                onPress={() => navigation.navigate('CheckIn', { shift: activeShift })}
                style={styles.checkInBtn}
              />
            </View>
          </View>
        )}

        <View style={styles.ledgerCard}>
          <Text style={styles.ledgerTitle}>Quy trình thực hiện tại nhà người bệnh</Text>
          {[
            '1. Xem trước hồ sơ dị ứng, vận động và chỉ đường GPS',
            `2. Điểm danh trong phạm vi ${CHECKIN_MAX_RADIUS_METERS}m bằng ảnh selfie trực tiếp`,
            '3. Đánh giá thể trạng 30 phút đầu và đo sinh tồn định kỳ',
            '4. Đối chiếu y lệnh gốc hoặc gọi SOS 115 khi khẩn cấp',
            '5. Lưu báo cáo tối thiểu và bàn giao ra về',
          ].map((step, idx, arr) => (
            <View
              key={step}
              style={[
                styles.stepRow,
                idx === arr.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 },
              ]}
            >
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  content: {
    padding: 18,
    paddingBottom: 32,
  },
  homeHead: {
    marginBottom: 18,
  },
  brandMark: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.brandJade,
    marginBottom: 4,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 22,
  },
  anchorCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  serviceName: {
    fontSize: 19,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    lineHeight: 26,
    marginBottom: 6,
  },
  patientInfo: {
    fontSize: 15.5,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
    marginBottom: 4,
  },
  addressInfo: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  briefingBtn: {
    flex: 1,
  },
  checkInBtn: {
    flex: 1.2,
  },
  ledgerCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  ledgerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 8,
  },
  stepRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  stepText: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 21,
  },
  hardwareWarnBox: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  hardwareWarnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: tokens.colors.alertCrimson,
    lineHeight: 19,
  },
});

