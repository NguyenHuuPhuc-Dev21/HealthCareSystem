import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { tokens } from '../../styles/tokens';
import { haversineDistanceMeters, CHECKIN_MAX_RADIUS_METERS } from '@healthcare-system/shared';
import { submitCheckIn } from './check-in.api';

interface GeoCoords {
  latitude: number;
  longitude: number;
  isMockLocation?: boolean;
}

interface GeolocationLike {
  getCurrentPosition?: (
    success: (pos: { coords: { latitude: number; longitude: number; mocked?: boolean } }) => void,
    error?: (err: { message?: string }) => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number }
  ) => void;
}

const IS_DEV = (globalThis as { __DEV__?: boolean }).__DEV__ === true;

interface CheckInScreenProps {
  bookingId: string;
  bookingCode: string;
  patientAddress: string;
  patientLatitude: number;
  patientLongitude: number;
  onRequestCurrentPosition?: () => Promise<GeoCoords>;
  onCaptureLivePhoto?: () => Promise<string | null>;
  onCheckInSuccess: (checkedInAt: string) => void;
  onCancel: () => void;
}

export const CheckInScreen: React.FC<CheckInScreenProps> = ({
  bookingId,
  bookingCode,
  patientAddress,
  patientLatitude,
  patientLongitude,
  onRequestCurrentPosition,
  onCaptureLivePhoto,
  onCheckInSuccess,
  onCancel,
}) => {
  const [deviceLat, setDeviceLat] = useState<number | null>(null);
  const [deviceLng, setDeviceLng] = useState<number | null>(null);
  const [gpsStatusText, setGpsStatusText] = useState<string>('Đang đọc tín hiệu GPS thực tế từ thiết bị...');
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [isMockLocation, setIsMockLocation] = useState<boolean>(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [capturedTime, setCapturedTime] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showSimulator, setShowSimulator] = useState<boolean>(false);

  const refreshDeviceLocation = useCallback(async () => {
    setGpsLoading(true);
    setGpsStatusText('Đang xác định tọa độ GPS thiết bị...');

    if (onRequestCurrentPosition) {
      try {
        const coords = await onRequestCurrentPosition();
        setDeviceLat(coords.latitude);
        setDeviceLng(coords.longitude);
        setIsMockLocation(Boolean(coords.isMockLocation));
        setGpsStatusText('Đã cập nhật tọa độ từ cảm biến định vị.');
      } catch {
        setGpsStatusText('Không thể đọc vị trí GPS. Vui lòng bật quyền Vị trí và thử lại.');
      } finally {
        setGpsLoading(false);
      }
      return;
    }

    const geolocation = (globalThis as { navigator?: { geolocation?: GeolocationLike } }).navigator?.geolocation;
    if (geolocation?.getCurrentPosition) {
      geolocation.getCurrentPosition(
        (pos) => {
          setDeviceLat(pos.coords.latitude);
          setDeviceLng(pos.coords.longitude);
          setIsMockLocation(Boolean(pos.coords.mocked));
          setGpsStatusText('Đã đồng bộ tọa độ GPS thiết bị.');
          setGpsLoading(false);
        },
        () => {
          setGpsStatusText('Chưa đọc được GPS thiết bị. Hãy kiểm tra quyền truy cập vị trí và thử lại.');
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return;
    }

    setGpsLoading(false);
    setGpsStatusText('Thiết bị chưa có mô-đun GPS khả dụng.');
  }, [onRequestCurrentPosition]);

  useEffect(() => {
    refreshDeviceLocation();
  }, [refreshDeviceLocation]);

  const distanceMeters =
    deviceLat !== null && deviceLng !== null
      ? Math.round(haversineDistanceMeters(deviceLat, deviceLng, patientLatitude, patientLongitude))
      : null;
  const isWithinRadius = distanceMeters !== null && distanceMeters <= CHECKIN_MAX_RADIUS_METERS;

  const handleLaunchHardwareCamera = async () => {
    if (onCaptureLivePhoto) {
      try {
        const uri = await onCaptureLivePhoto();
        if (uri) {
          setSelfieUri(uri);
          setCapturedTime(new Date().toLocaleTimeString('vi-VN'));
          Alert.alert('Đã chụp ảnh điểm danh', 'Ảnh selfie trực tiếp đã được gắn dấu tọa độ và thời gian.');
        }
      } catch {
        Alert.alert('Lỗi camera', 'Không thể mở camera thiết bị. Vui lòng kiểm tra quyền truy cập camera.');
      }
      return;
    }

    if (IS_DEV) {
      setSelfieUri(
        'https://images.unsplash.com/photo-1594824813583-1180b271d440?auto=format&fit=crop&w=400&q=80'
      );
      setCapturedTime(new Date().toLocaleTimeString('vi-VN'));
      Alert.alert('[DEV] Ảnh mô phỏng điểm danh', 'Chỉ dùng ảnh mẫu trong môi trường phát triển.');
      return;
    }

    Alert.alert(
      'Chưa hỗ trợ camera phần cứng',
      'Ứng dụng cần kết nối camera trực tiếp (onCaptureLivePhoto) để chụp ảnh điểm danh xác thực.'
    );
  };

  const handlePerformCheckIn = async () => {
    if (isMockLocation) {
      Alert.alert(
        'Vị trí không hợp lệ',
        'Hệ thống phát hiện thiết bị đang dùng phần mềm giả lập GPS. Hãy tắt định vị giả lập để điểm danh vào ca.'
      );
      return;
    }

    if (deviceLat === null || deviceLng === null || distanceMeters === null) {
      Alert.alert(
        'Chưa có tọa độ GPS',
        'Vui lòng cập nhật vị trí GPS thực tế của thiết bị trước khi xác nhận điểm danh.'
      );
      return;
    }

    if (!isWithinRadius) {
      Alert.alert(
        'Bạn chưa tới gần nhà người bệnh',
        `Khoảng cách hiện tại là ${distanceMeters}m (quy định trong vòng ${CHECKIN_MAX_RADIUS_METERS}m). Hãy di chuyển lại gần địa chỉ ca trực.`
      );
      return;
    }

    if (!selfieUri) {
      Alert.alert('Chưa có ảnh điểm danh', 'Vui lòng chụp ảnh selfie trực tiếp tại chỗ bằng camera.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('bookingId', bookingId);
    formData.append('latitude', String(deviceLat));
    formData.append('longitude', String(deviceLng));
    formData.append('isMockLocation', String(isMockLocation));
    formData.append('selfie', {
      uri: selfieUri,
      name: `checkin_${bookingCode}.jpg`,
      type: 'image/jpeg',
    } as any);

    try {
      const res = await submitCheckIn(bookingId, formData);
      setLoading(false);
      if (res.success) {
        onCheckInSuccess(res.data?.checked_in_at || new Date().toISOString());
      } else {
        Alert.alert('Không thể điểm danh', res.error?.message || 'Vui lòng kiểm tra kết nối và thử lại.');
      }
    } catch {
      setLoading(false);
      Alert.alert('Không thể điểm danh', 'Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Đơn {bookingCode}</Text>
      <Text style={styles.title}>Điểm danh bắt đầu ca trực</Text>
      <Text style={styles.subtitle}>
        Xác nhận vị trí trong phạm vi {CHECKIN_MAX_RADIUS_METERS}m quanh nhà người bệnh và chụp ảnh trực tiếp.
      </Text>

      {/* Bước 1: Định vị GPS */}
      <View
        style={[
          styles.ledgerCard,
          { borderColor: isWithinRadius && !isMockLocation ? tokens.colors.brandJade : tokens.colors.alertCrimson },
        ]}
      >
        <Text style={styles.sectionHeader}>1. Xác thực vị trí tại nhà</Text>
        <Text style={styles.infoText}>{patientAddress}</Text>

        <View
          style={[
            styles.statusPill,
            {
              backgroundColor:
                isWithinRadius && !isMockLocation ? tokens.colors.brandJadeSoft : tokens.colors.alertCrimsonSoft,
            },
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              {
                color: isWithinRadius && !isMockLocation ? tokens.colors.brandJade : tokens.colors.alertCrimson,
              },
            ]}
          >
            {isMockLocation
              ? 'Phát hiện định vị giả lập — Bị chặn điểm danh'
              : distanceMeters === null
              ? gpsStatusText
              : isWithinRadius
              ? `Đạt chuẩn vị trí (cách ${distanceMeters}m / ${CHECKIN_MAX_RADIUS_METERS}m)`
              : `Ngoài phạm vi cho phép (cách ${distanceMeters}m > ${CHECKIN_MAX_RADIUS_METERS}m)`}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.gpsRefreshBtn}
          onPress={refreshDeviceLocation}
          disabled={gpsLoading}
          accessibilityRole="button"
          accessibilityLabel="Cập nhật vị trí GPS hiện tại"
        >
          <Text style={styles.gpsRefreshText}>
            {gpsLoading ? 'Đang lấy GPS...' : 'Cập nhật vị trí GPS hiện tại'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bước 2: Chụp ảnh trực tiếp */}
      <View style={styles.ledgerCard}>
        <Text style={styles.sectionHeader}>2. Chụp ảnh xác nhận trực tiếp</Text>
        <Text style={styles.hint}>
          Chỉ dùng camera trực tiếp (không chọn ảnh từ thư viện). Ảnh được đóng dấu giờ và gửi cho gia đình người bệnh.
        </Text>

        {selfieUri ? (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: selfieUri }}
              style={styles.previewImage}
              accessibilityLabel="Ảnh selfie điểm danh tại nhà người bệnh"
            />
            <View style={styles.watermark}>
              <Text style={styles.watermarkText}>
                CareNest · {deviceLat !== null && deviceLng !== null ? `${deviceLat.toFixed(4)}, ${deviceLng.toFixed(4)}` : 'Chờ GPS'} · {capturedTime}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={handleLaunchHardwareCamera}
              accessibilityRole="button"
              accessibilityLabel="Chụp lại ảnh điểm danh"
            >
              <Text style={styles.retakeText}>Chụp lại</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={handleLaunchHardwareCamera}
            accessibilityRole="button"
            accessibilityLabel="Mở camera chụp ảnh tại chỗ"
          >
            <Text style={styles.cameraBtnText}>Mở camera chụp ảnh tại chỗ</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Quay lại màn hình trước"
        >
          <Text style={styles.cancelBtnText}>Quay lại</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!isWithinRadius || isMockLocation || !selfieUri || loading) && styles.btnDisabled,
          ]}
          disabled={!isWithinRadius || isMockLocation || !selfieUri || loading}
          onPress={handlePerformCheckIn}
          accessibilityRole="button"
          accessibilityLabel="Xác nhận vào ca"
          accessibilityState={{ disabled: !isWithinRadius || isMockLocation || !selfieUri || loading }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Xác nhận vào ca</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Collapsible Dev GPS Simulator — strictly gated to __DEV__ builds */}
      {IS_DEV && (
        <>
          <TouchableOpacity
            style={styles.simToggle}
            onPress={() => setShowSimulator((v) => !v)}
          >
            <Text style={styles.simToggleText}>
              {showSimulator ? 'Ẩn công cụ mô phỏng GPS' : 'Công cụ mô phỏng GPS (kiểm thử DEV)'}
            </Text>
          </TouchableOpacity>

          {showSimulator && (
            <View style={styles.simBox}>
              <View style={styles.devBar}>
                <TouchableOpacity
                  style={styles.devBtn}
                  onPress={() => {
                    setDeviceLat(patientLatitude + 0.0003);
                    setDeviceLng(patientLongitude + 0.0003);
                  }}
                >
                  <Text style={styles.devBtnText}>Tại chỗ (khoảng 35m)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.devBtn}
                  onPress={() => {
                    setDeviceLat(patientLatitude + 0.004);
                    setDeviceLng(patientLongitude + 0.004);
                  }}
                >
                  <Text style={styles.devBtnText}>Ở xa (khoảng 450m)</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.mockToggle}
                onPress={() => setIsMockLocation(!isMockLocation)}
              >
                <Text style={{ fontSize: 13.5, color: isMockLocation ? tokens.colors.alertCrimson : tokens.colors.inkSecondary }}>
                  {isMockLocation ? 'Đang bật giả lập Fake GPS (Bấm để tắt)' : 'Đang tắt giả lập GPS (Bấm để thử nghiệm chặn)'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.brandJade,
    marginBottom: 4,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 22,
    marginBottom: 18,
  },
  ledgerCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 15,
    color: tokens.colors.inkSecondary,
    marginBottom: 12,
    lineHeight: 21,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  gpsRefreshBtn: {
    marginTop: 10,
    minHeight: tokens.spacing.touchTargetMin,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  gpsRefreshText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.brandJade,
  },
  hint: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    marginBottom: 12,
    lineHeight: 21,
  },
  cameraBtn: {
    height: 112,
    backgroundColor: tokens.colors.brandJadeSoft,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  previewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    height: 200,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  watermark: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(16, 42, 36, 0.82)',
    padding: 8,
  },
  watermarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  retakeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(16, 42, 36, 0.78)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retakeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.paper,
  },
  cancelBtnText: {
    fontSize: 15.5,
    color: tokens.colors.inkSecondary,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    height: 52,
    backgroundColor: tokens.colors.brandJade,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    fontSize: 16.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  simToggle: {
    marginTop: 22,
    alignSelf: 'center',
    paddingVertical: 6,
  },
  simToggleText: {
    fontSize: 13.5,
    color: tokens.colors.inkMuted,
    textDecorationLine: 'underline',
  },
  simBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: tokens.colors.subtle,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  devBar: {
    flexDirection: 'row',
    gap: 8,
  },
  devBtn: {
    flex: 1,
    backgroundColor: tokens.colors.paper,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  devBtnText: {
    fontSize: 13,
    color: tokens.colors.inkPrimary,
    fontWeight: '600',
  },
  mockToggle: {
    marginTop: 10,
  },
});
