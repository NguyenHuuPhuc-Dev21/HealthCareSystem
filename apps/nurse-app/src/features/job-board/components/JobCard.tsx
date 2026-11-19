import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Banknote,
  Clock,
  FileCheck2,
  Lock,
  MapPin,
  Moon,
  Sparkles,
} from 'lucide-react-native';
import type { JobItem } from '@healthcare-system/shared';
import { calculateJobNetAmount } from '@healthcare-system/shared';
import { StatusBadge } from '../../../components';
import { tokens } from '../../../styles/tokens';

export interface JobCardProps {
  job: JobItem;
  isLocked?: boolean;
  depositGraceActive?: boolean;
  onPress: (job: JobItem) => void;
  onAccept?: (job: JobItem) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  isLocked = false,
  depositGraceActive = false,
  onPress,
  onAccept,
}) => {
  const netAmount = job.netAmount ?? calculateJobNetAmount(job.totalAmount);
  const isNightShift = Boolean(
    job.nightSurcharge ||
      job.serviceName.toLowerCase().includes('đêm') ||
      parseInt(job.startTime.split(':')[0], 10) >= 19 ||
      parseInt(job.startTime.split(':')[0], 10) < 6
  );

  return (
    <TouchableOpacity
      style={[styles.card, isLocked && styles.cardLocked]}
      activeOpacity={isLocked ? 0.9 : 0.75}
      onPress={() => onPress(job)}
      accessibilityRole="button"
      accessibilityLabel={`Ca ${job.serviceName}, giá ${job.totalAmount.toLocaleString('vi-VN')} đồng, thực nhận ${netAmount.toLocaleString('vi-VN')} đồng`}
    >
      {/* Badges bar */}
      <View style={styles.badgeRow}>
        {depositGraceActive && (
          <StatusBadge label="Chuyển khoản" tone="jade" />
        )}

        {!depositGraceActive && job.paymentMethod === 'BANK_TRANSFER' && (
          <StatusBadge label="Chuyển khoản" tone="jade" />
        )}

        {!depositGraceActive && job.paymentMethod === 'CASH' && (
          <StatusBadge label="Tiền mặt" tone="ochre" />
        )}

        {job.hasPrescription && (
          <View style={styles.badgeInline}>
            <FileCheck2 size={13} color="#D97706" />
            <Text style={styles.badgeAmberText}>Cần y lệnh</Text>
          </View>
        )}

        {isNightShift && (
          <View style={styles.badgeInlineNight}>
            <Moon size={13} color="#4338CA" />
            <Text style={styles.badgeNightText}>Ca đêm</Text>
          </View>
        )}

        {Boolean(job.urgentBonus) && (
          <View style={styles.badgeInlineBonus}>
            <Sparkles size={13} color="#DC2626" />
            <Text style={styles.badgeBonusText}>Có thưởng gấp</Text>
          </View>
        )}

        {isLocked && (
          <View style={styles.badgeInlineLocked}>
            <Lock size={13} color="#EF4444" />
            <Text style={styles.badgeLockedText}>Khóa Cấp 2</Text>
          </View>
        )}
      </View>

      {/* Service Name */}
      <View style={styles.headerRow}>
        <Text style={[styles.serviceName, isLocked && styles.textMuted]}>
          {job.serviceName}
        </Text>
        <Text style={[styles.codeText, isLocked && styles.textMuted]}>
          {job.code}
        </Text>
      </View>

      {/* Time & Location */}
      <View style={styles.infoRow}>
        <Clock size={16} color={tokens.colors.inkSecondary} />
        <Text style={styles.infoText}>
          {job.startTime} – {job.endTime} · {job.date}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <MapPin size={16} color={tokens.colors.inkSecondary} />
        <Text style={styles.infoText}>
          Quận {job.district} · Cách {job.distanceKm.toFixed(1)} km
        </Text>
      </View>

      {/* Pricing: Total and Net Income */}
      <View style={styles.priceContainer}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Tổng tiền:</Text>
          <Text style={styles.totalAmount}>
            {job.totalAmount.toLocaleString('vi-VN')}đ
          </Text>
        </View>

        <View style={styles.netAmountRow}>
          <Banknote size={18} color={tokens.colors.brandJade} />
          <Text style={styles.netAmountText}>
            Thu về: <Text style={styles.netAmountHighlight}>{netAmount.toLocaleString('vi-VN')}đ</Text> (sau trừ 15%)
          </Text>
        </View>
      </View>

      {/* Locked message or Action Button */}
      {isLocked ? (
        <View style={styles.lockedNoticeBox}>
          <Lock size={16} color="#DC2626" />
          <Text style={styles.lockedNoticeText}>
            Cần Tầng 2 (có GPHN còn hạn)
          </Text>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.detailButton}
            onPress={() => onPress(job)}
            activeOpacity={0.7}
          >
            <Text style={styles.detailButtonText}>Xem chi tiết</Text>
          </TouchableOpacity>

          {onAccept && (
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => onAccept(job)}
              activeOpacity={0.7}
            >
              <Text style={styles.acceptButtonText}>Nhận ca</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLocked: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    opacity: 0.72,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeAmberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  badgeInlineNight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeNightText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338CA',
  },
  badgeInlineBonus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeBonusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  badgeInlineLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeLockedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  serviceName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    lineHeight: 23,
  },
  codeText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
    paddingTop: 2,
  },
  textMuted: {
    color: '#6B7280',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    fontWeight: '500',
  },
  priceContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
    textDecorationLine: 'none',
  },
  netAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  netAmountText: {
    fontSize: 15.5,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
  },
  netAmountHighlight: {
    fontSize: 17,
    fontWeight: '800',
    color: tokens.colors.brandJade,
  },
  lockedNoticeBox: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  lockedNoticeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  detailButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.paper,
  },
  detailButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  acceptButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: tokens.colors.brandJade,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
