import React, { useState } from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
  ActivityIndicator,
} from 'react-native';
import { tokens } from '../../styles/tokens';
import { triggerSos, type SosResult } from './sos.api';
import type { DeviceGeoCoords } from '../../lib/hardware-providers';

export interface SosButtonProps {
  bookingId: string;
  patientLatitude: number;
  patientLongitude: number;
  onRequestCurrentPosition?: () => Promise<DeviceGeoCoords>;
  getLatestVitals?: () => Record<string, unknown> | undefined;
  style?: StyleProp<ViewStyle>;
  variant?: 'compact' | 'full';
  onSosTriggered?: (result: SosResult) => void;
}

/**
 * Global zero-latency SOS button.
 * CRITICAL SAFETY REQUIREMENT:
 * 1. Calls Linking.openURL('tel:115') FIRST immediately, ensuring dialer opens with 0ms network latency even if offline.
 * 2. Asynchronously dispatches POST /bookings/:id/sos to server, falling back to offline-queue if network is down.
 */
export const SosButton: React.FC<SosButtonProps> = ({
  bookingId,
  patientLatitude,
  patientLongitude,
  onRequestCurrentPosition,
  getLatestVitals,
  style,
  variant = 'compact',
  onSosTriggered,
}) => {
  const [sending, setSending] = useState(false);

  const executeSosSequence = async () => {
    // 1. FIRST ACTION: Dial 115 with zero network latency
    try {
      await Linking.openURL('tel:115');
    } catch {
      // In emulator or environments without telephony, openURL may fail
    }

    // 2. SECOND ACTION: Asynchronously obtain GPS and dispatch SOS to backend/queue
    setSending(true);
    let lat = patientLatitude;
    let lng = patientLongitude;

    if (onRequestCurrentPosition) {
      try {
        const coords = await onRequestCurrentPosition();
        lat = coords.latitude;
        lng = coords.longitude;
      } catch {
        // Fallback to shift patient coordinates if hardware GPS unavailable
      }
    }

    const currentVitals = getLatestVitals ? getLatestVitals() : undefined;

    try {
      const res = await triggerSos({
        bookingId,
        latitude: lat,
        longitude: lng,
        currentVitals,
      });

      setSending(false);
      onSosTriggered?.(res);

      if (res.isOfflineQueued) {
        Alert.alert(
          'Đã mở 115 & Lưu hàng đợi SOS',
          'Đã kích hoạt cuộc gọi 115. Do thiết bị đang ngoại tuyến, dữ liệu GPS và sinh tồn đã lưu vào hàng đợi và sẽ tự động gửi tới điều phối viên ngay khi có mạng.'
        );
      } else if (res.success) {
        Alert.alert(
          'Đã phát tín hiệu SOS',
          'Tọa độ GPS và chỉ số sinh tồn mới nhất đã được gửi tới điều phối viên và gia đình người bệnh.'
        );
      } else {
        Alert.alert('Chưa kết nối máy chủ', res.error?.message || 'Đã lưu yêu cầu vào thiết bị.');
      }
    } catch {
      setSending(false);
      Alert.alert(
        'Lưu ý ngoại tuyến',
        'Đã mở cuộc gọi 115. Dữ liệu cảnh báo tọa độ sẽ được gửi lại khi thiết bị có kết nối mạng.'
      );
    }
  };

  const handlePress = () => {
    Alert.alert(
      'Gọi cấp cứu SOS 115',
      'Ứng dụng sẽ mở ngay trình gọi 115 và đồng thời gửi tọa độ GPS cùng chỉ số sinh tồn tới điều phối viên và gia đình.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gọi 115 ngay',
          style: 'destructive',
          onPress: () => {
            void executeSosSequence();
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[
        variant === 'full' ? styles.fullButton : styles.compactButton,
        sending && styles.buttonDisabled,
        style,
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Gọi cấp cứu khẩn cấp SOS 115"
      accessibilityHint="Mở ngay màn hình quay số 115 và phát cảnh báo định vị tới hệ thống"
      disabled={sending}
    >
      {sending ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Text style={variant === 'full' ? styles.fullButtonText : styles.compactButtonText}>
          SOS 115
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  compactButton: {
    backgroundColor: tokens.colors.alertCrimson,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  compactButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  fullButton: {
    backgroundColor: tokens.colors.alertCrimson,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  fullButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
