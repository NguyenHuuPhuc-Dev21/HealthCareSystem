import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { tokens } from '../../styles/tokens';

interface ShiftBriefingScreenProps {
  bookingCode: string;
  serviceName: string;
  timeRange: string;
  patientName: string;
  patientAge: number;
  patientAddress: string;
  mobilityNote: string;
  allergies: string;
  isInvasive: boolean;
  prescriptionSummary?: string;
  onProceedToCheckIn: () => void;
  onBack: () => void;
}

export const ShiftBriefingScreen: React.FC<ShiftBriefingScreenProps> = ({
  bookingCode,
  serviceName,
  timeRange,
  patientName,
  patientAge,
  patientAddress,
  mobilityNote,
  allergies,
  isInvasive,
  prescriptionSummary,
  onProceedToCheckIn,
  onBack,
}) => {
  const handleOpenDirections = () => {
    const query = encodeURIComponent(patientAddress);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>Quay lại danh sách ca</Text>
      </TouchableOpacity>

      <Text style={styles.eyebrow}>Hồ sơ trước ca trực · {bookingCode}</Text>
      <Text style={styles.title}>{serviceName}</Text>
      <Text style={styles.timeLine}>Thời gian thực hiện: {timeRange}</Text>

      {/* Phiếu thông tin người bệnh */}
      <View style={styles.ledgerCard}>
        <Text style={styles.cardHeading}>Thông tin người bệnh</Text>

        <View style={styles.ledgerRow}>
          <Text style={styles.rowLabel}>Họ tên &amp; độ tuổi</Text>
          <Text style={styles.rowValue}>{patientName} ({patientAge} tuổi)</Text>
        </View>

        <View style={styles.ledgerRow}>
          <Text style={styles.rowLabel}>Khả năng vận động dự kiến</Text>
          <Text style={styles.rowValue}>{mobilityNote}</Text>
        </View>

        <View style={[styles.ledgerRow, styles.ledgerRowLast]}>
          <Text style={styles.rowLabel}>Lưu ý dị ứng</Text>
          <Text style={[styles.rowValue, { color: tokens.colors.alertCrimson }]}>
            {allergies || 'Chưa ghi nhận dị ứng'}
          </Text>
        </View>
      </View>

      {/* Địa chỉ & Điều hướng */}
      <View style={styles.ledgerCard}>
        <Text style={styles.cardHeading}>Địa điểm chăm sóc</Text>
        <Text style={styles.addressText}>{patientAddress}</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleOpenDirections}>
          <Text style={styles.secondaryBtnText}>Mở bản đồ chỉ đường</Text>
        </TouchableOpacity>
      </View>

      {/* Y lệnh kèm theo nếu là ca Cấp 2 */}
      {isInvasive && (
        <View style={[styles.ledgerCard, { borderColor: tokens.colors.accentOchre, backgroundColor: '#FFFDF7' }]}>
          <Text style={[styles.cardHeading, { color: tokens.colors.accentOchre }]}>
            Kiểm tra y lệnh bác sĩ tại nhà
          </Text>
          <Text style={styles.bodyCopy}>
            {prescriptionSummary ||
              'Ca thủ thuật xâm lấn có đính kèm ảnh y lệnh. Khi tới nơi, bạn cần đối chiếu bản gốc và hộp thuốc trước khi thực hiện.'}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.primaryBtn} onPress={onProceedToCheckIn}>
        <Text style={styles.primaryBtnText}>Tôi đã tới nơi, điểm danh vào ca</Text>
      </TouchableOpacity>
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
    paddingBottom: 36,
  },
  backBtn: {
    marginBottom: 14,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.brandJade,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.brandJade,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    lineHeight: 28,
    marginBottom: 6,
  },
  timeLine: {
    fontSize: 15.5,
    color: tokens.colors.inkSecondary,
    marginBottom: 18,
  },
  ledgerCard: {
    backgroundColor: tokens.colors.paper,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  cardHeading: {
    fontSize: 16.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 10,
  },
  ledgerRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  ledgerRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  rowLabel: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
  },
  addressText: {
    fontSize: 16,
    color: tokens.colors.inkPrimary,
    lineHeight: 23,
    marginBottom: 12,
  },
  bodyCopy: {
    fontSize: 15,
    color: tokens.colors.inkSecondary,
    lineHeight: 22,
  },
  secondaryBtn: {
    height: tokens.spacing.touchTargetMin,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.paper,
  },
  secondaryBtnText: {
    fontSize: 15.5,
    fontWeight: '600',
    color: tokens.colors.brandJade,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 12,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

