import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Banknote } from 'lucide-react-native';
import {
  BookingDisputeStatus,
  ExecutionStatus,
  PaymentMethod,
  PaymentStatus,
} from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';

export interface ShiftStatusBadgesProps {
  executionStatus?: ExecutionStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod | string;
  disputeStatus?: BookingDisputeStatus;
  compact?: boolean;
}

export const ShiftStatusBadges: React.FC<ShiftStatusBadgesProps> = ({
  executionStatus,
  paymentStatus,
  paymentMethod,
  disputeStatus,
  compact = false,
}) => {
  const isCash = paymentMethod === PaymentMethod.CASH || paymentMethod === 'CASH';
  const hasDispute =
    disputeStatus === BookingDisputeStatus.OPEN ||
    disputeStatus === BookingDisputeStatus.UNDER_REVIEW;

  const getExecutionBadge = () => {
    switch (executionStatus) {
      case ExecutionStatus.IN_PROGRESS:
        return { label: 'Đang thực hiện', style: styles.badgeJade, textStyle: styles.textJade };
      case ExecutionStatus.CONFIRMED:
        return { label: 'Sắp diễn ra', style: styles.badgeOchre, textStyle: styles.textOchre };
      case ExecutionStatus.COMPLETED:
        return { label: 'Đã hoàn thành', style: styles.badgeNeutral, textStyle: styles.textNeutral };
      case ExecutionStatus.CANCELLED:
        return { label: 'Đã dừng an toàn', style: styles.badgeCrimson, textStyle: styles.textCrimson };
      default:
        return null;
    }
  };

  const getPaymentBadge = () => {
    if (isCash) {
      if (executionStatus === ExecutionStatus.COMPLETED) {
        return { label: 'Tiền mặt · Chờ nộp hoa hồng', style: styles.badgeCrimsonSoft, textStyle: styles.textCrimson };
      }
      return { label: 'Tiền mặt tại nhà', style: styles.badgeOchre, textStyle: styles.textOchre };
    }

    switch (paymentStatus) {
      case PaymentStatus.ESCROW_HELD:
        return { label: 'Chờ quyết toán (24h)', style: styles.badgeTealSoft, textStyle: styles.textTeal };
      case PaymentStatus.SETTLED:
        return { label: 'Đã quyết toán', style: styles.badgeJadeSoft, textStyle: styles.textJade };
      case PaymentStatus.REFUNDED:
        return { label: 'Đã hoàn tiền', style: styles.badgeCrimsonSoft, textStyle: styles.textCrimson };
      default:
        return null;
    }
  };

  const execMeta = getExecutionBadge();
  const payMeta = getPaymentBadge();

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* 1. Trục Thực hiện */}
      {execMeta ? (
        <View style={[styles.badge, execMeta.style]}>
          <Text style={[styles.badgeText, execMeta.textStyle]}>{execMeta.label}</Text>
        </View>
      ) : null}

      {/* 2. Trục Thanh toán */}
      {payMeta ? (
        <View style={[styles.badge, payMeta.style, isCash && styles.badgeWithIcon]}>
          {isCash && <Banknote size={13} color={payMeta.textStyle.color} style={styles.badgeIcon} />}
          <Text style={[styles.badgeText, payMeta.textStyle]}>{payMeta.label}</Text>
        </View>
      ) : null}

      {/* 3. Trục Khiếu nại */}
      {hasDispute ? (
        <View style={[styles.badge, styles.badgeCrimsonSoft, styles.badgeWithIcon]}>
          <AlertTriangle size={13} color={tokens.colors.alertCrimson} style={styles.badgeIcon} />
          <Text style={[styles.badgeText, styles.textCrimson]}>Đang khiếu nại</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  containerCompact: {
    gap: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWithIcon: {
    flexDirection: 'row',
    gap: 4,
  },
  badgeIcon: {
    marginRight: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeJade: {
    backgroundColor: tokens.colors.brandJade,
  },
  textJade: {
    color: '#FFFFFF',
  },
  badgeJadeSoft: {
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  badgeTealSoft: {
    backgroundColor: '#E6F4F1',
  },
  textTeal: {
    color: '#0D6856',
  },
  badgeOchre: {
    backgroundColor: tokens.colors.accentOchreSoft,
  },
  textOchre: {
    color: tokens.colors.accentOchre,
  },
  badgeNeutral: {
    backgroundColor: tokens.colors.subtle,
  },
  textNeutral: {
    color: tokens.colors.inkSecondary,
  },
  badgeCrimson: {
    backgroundColor: tokens.colors.alertCrimson,
  },
  badgeCrimsonSoft: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  textCrimson: {
    color: tokens.colors.alertCrimson,
  },
});
