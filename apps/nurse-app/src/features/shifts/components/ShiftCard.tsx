import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  ChevronRight,
  Clock,
  MapPin,
  Moon,
  ShieldAlert,
  User,
} from 'lucide-react-native';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  ExecutionStatus,
  PaymentMethod,
  type MobileShiftSummary,
} from '@healthcare-system/shared';
import { AppButton } from '../../../components';
import { formatVND } from '../../../lib/formatters';
import { tokens } from '../../../styles/tokens';
import { ShiftStatusBadges } from './ShiftStatusBadges';

export interface ShiftCardProps {
  shift: MobileShiftSummary;
  onPress: (shift: MobileShiftSummary) => void;
  onActionPress?: (shift: MobileShiftSummary) => void;
  testID?: string;
}

export const ShiftCard: React.FC<ShiftCardProps> = ({
  shift,
  onPress,
  onActionPress,
  testID,
}) => {
  const isInProgress = shift.executionStatus === ExecutionStatus.IN_PROGRESS;
  const isConfirmed =
    shift.executionStatus === ExecutionStatus.CONFIRMED ||
    shift.executionStatus === undefined;
  const isCompleted = shift.executionStatus === ExecutionStatus.COMPLETED;
  const isCash = shift.paymentMethod === PaymentMethod.CASH || shift.paymentMethod === 'CASH';
  const isNightShift = Boolean(
    shift.serviceName.toLowerCase().includes('đêm') ||
    (shift.timeRange && shift.timeRange.toLowerCase().includes('tối'))
  );

  // Tính số tiền thực nhận sau hoa hồng CareNest
  const netPay =
    shift.netAmount ??
    (shift.totalAmount
      ? Math.round(shift.totalAmount * (1 - DEFAULT_PLATFORM_COMMISSION_RATE))
      : 425000);

  const handleCardPress = () => {
    onPress(shift);
  };

  const handleAction = () => {
    if (onActionPress) {
      onActionPress(shift);
    } else {
      onPress(shift);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isInProgress && styles.cardInProgress,
        isNightShift && styles.cardNight,
      ]}
      onPress={handleCardPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Ca trực ${shift.bookingCode}, ${shift.serviceName}`}
      testID={testID}
    >
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <View style={styles.codeRow}>
          {isNightShift ? <Moon color="#4338CA" size={16} /> : null}
          <Text style={styles.bookingCode}>{shift.bookingCode}</Text>
          {isCash ? (
            <View style={styles.cashBadge}>
              <Text style={styles.cashBadgeText}>Tiền mặt</Text>
            </View>
          ) : null}
        </View>

        <ShiftStatusBadges
          executionStatus={shift.executionStatus}
          paymentStatus={shift.paymentStatus}
          paymentMethod={shift.paymentMethod}
          disputeStatus={shift.disputeStatus}
          compact
        />
      </View>

      {/* Service Name & Pay */}
      <View style={styles.mainRow}>
        <View style={styles.serviceBox}>
          <Text style={styles.serviceName}>{shift.serviceName}</Text>
          <View style={styles.timeRow}>
            <Clock color={tokens.colors.inkSecondary} size={15} />
            <Text style={styles.timeText}>{shift.timeRange}</Text>
          </View>
        </View>

        <View style={styles.payBox}>
          <Text style={styles.payLabel}>Thực nhận</Text>
          <Text style={styles.payAmount}>+{formatVND(netPay)}</Text>
        </View>
      </View>

      {/* Patient & Location */}
      <View style={styles.patientRow}>
        <View style={styles.patientItem}>
          <User color={tokens.colors.inkSecondary} size={15} />
          <Text style={styles.patientText}>
            {shift.patientName} ({shift.patientAge} tuổi)
          </Text>
        </View>
        <View style={styles.patientItem}>
          <MapPin color={tokens.colors.brandJade} size={15} />
          <Text style={styles.addressText} numberOfLines={1}>
            {shift.district ? `${shift.district} · ` : ''}
            {shift.patientAddress}
          </Text>
        </View>
      </View>

      {/* Invasive notice */}
      {shift.isInvasive ? (
        <View style={styles.invasiveBox}>
          <ShieldAlert color={tokens.colors.accentOchre} size={15} />
          <Text style={styles.invasiveText}>Thủ thuật xâm lấn — Cần đối chiếu y lệnh gốc</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.footerRow}>
        {isInProgress ? (
          <AppButton
            label="Tiếp tục ca đang chạy"
            onPress={handleAction}
            style={styles.actionBtn}
          />
        ) : isConfirmed ? (
          <AppButton
            label="Xem hồ sơ & Điểm danh"
            variant="secondary"
            onPress={handleAction}
            style={styles.actionBtn}
          />
        ) : (
          <View style={styles.completedDetailRow}>
            <Text style={styles.completedDetailHint}>
              {isCash && shift.commissionAmount
                ? `Cần nộp ${formatVND(shift.commissionAmount)} hoa hồng`
                : 'Bấm để xem báo cáo ca đã bàn giao'}
            </Text>
            <ChevronRight color={tokens.colors.inkSecondary} size={18} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    marginBottom: 12,
  },
  cardInProgress: {
    borderColor: tokens.colors.brandJade,
    borderWidth: 2,
    backgroundColor: '#FAFDFB',
  },
  cardNight: {
    borderLeftWidth: 4,
    borderLeftColor: '#4338CA',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookingCode: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  cashBadge: {
    backgroundColor: tokens.colors.accentOchreSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.radii.pill,
  },
  cashBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.accentOchre,
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  serviceBox: {
    flex: 1,
  },
  serviceName: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    lineHeight: 23,
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeText: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  payBox: {
    alignItems: 'flex-end',
    minWidth: 100,
  },
  payLabel: {
    fontSize: 12,
    color: tokens.colors.inkSecondary,
    marginBottom: 2,
  },
  payAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  patientRow: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
    paddingTop: 10,
    gap: 6,
    marginBottom: 10,
  },
  patientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  patientText: {
    fontSize: 14,
    color: tokens.colors.inkPrimary,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    flex: 1,
  },
  invasiveBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.accentOchreSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radii.sm,
    marginBottom: 10,
  },
  invasiveText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.accentOchre,
    flex: 1,
  },
  footerRow: {
    marginTop: 2,
  },
  actionBtn: {
    width: '100%',
    minHeight: 46,
  },
  completedDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  completedDetailHint: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    fontWeight: '500',
  },
});
