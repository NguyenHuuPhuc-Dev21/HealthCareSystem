import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Clock, Star, User } from 'lucide-react-native';
import type { DirectInvitation } from '@healthcare-system/shared';
import { calculateJobNetAmount } from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';

export interface DirectInviteCardProps {
  invite: DirectInvitation;
  onAccept: (bookingId: string) => void;
  onDecline: (bookingId: string) => void;
  onExpire?: () => void;
}

export const DirectInviteCard: React.FC<DirectInviteCardProps> = ({
  invite,
  onAccept,
  onDecline,
  onExpire,
}) => {
  const calculateRemainingSeconds = (): number => {
    if (invite.expiresAt) {
      const diff = Math.floor((new Date(invite.expiresAt).getTime() - Date.now()) / 1000);
      return Math.max(0, diff);
    }
    return invite.expiresInSeconds ?? 15 * 60;
  };

  const [remainingSeconds, setRemainingSeconds] = useState<number>(calculateRemainingSeconds);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    setRemainingSeconds(calculateRemainingSeconds());
    setIsExpired(false);
  }, [invite]);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      setIsExpired(true);
      onExpire?.();
      return;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsExpired(true);
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingSeconds, onExpire]);

  if (isExpired) {
    return (
      <View style={styles.expiredCard}>
        <Text style={styles.expiredText}>
          Lời mời đã chuyển cho điều dưỡng khác do quá 15 phút.
        </Text>
      </View>
    );
  }

  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const seconds = String(remainingSeconds % 60).padStart(2, '0');
  const netAmount = calculateJobNetAmount(invite.totalAmount);

  return (
    <View style={styles.card}>
      {/* Top Banner Tag */}
      <View style={styles.badgeRow}>
        <View style={styles.starBadge}>
          <Star size={14} color="#D97706" fill="#D97706" />
          <Text style={styles.starBadgeText}>Khách chọn trực tiếp bạn</Text>
        </View>
        <View style={styles.countdownBadge}>
          <Clock size={14} color="#DC2626" />
          <Text style={styles.countdownText}>
            ⏱ Còn {minutes}:{seconds}
          </Text>
        </View>
      </View>

      {/* Main Info */}
      <Text style={styles.serviceTitle}>
        {invite.serviceName} — {invite.totalAmount.toLocaleString('vi-VN')}đ
      </Text>

      <Text style={styles.metaText}>
        {invite.startTime} {invite.date} · Quận {invite.district} · Thu về{' '}
        <Text style={styles.netHighlight}>{netAmount.toLocaleString('vi-VN')}đ</Text>
      </Text>

      <View style={styles.patientRow}>
        <User size={15} color={tokens.colors.inkSecondary} />
        <Text style={styles.patientText}>
          Người bệnh: <Text style={styles.patientName}>{invite.patientName}</Text> ({invite.patientAge} tuổi) · Người mời: {invite.inviterName}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={() => onDecline(invite.bookingId)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Từ chối lời mời"
        >
          <Text style={styles.declineButtonText}>Từ chối</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => onAccept(invite.bookingId)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Nhận ca này"
        >
          <Text style={styles.acceptButtonText}>Nhận ca này</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F0C36D',
    borderWidth: 2,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  expiredCard: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  expiredText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  starBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  starBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    lineHeight: 24,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    marginBottom: 10,
  },
  netHighlight: {
    fontWeight: '800',
    color: tokens.colors.brandJade,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  patientText: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    flex: 1,
  },
  patientName: {
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  declineButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  acceptButton: {
    flex: 2,
    height: 52,
    borderRadius: 12,
    backgroundColor: tokens.colors.brandJade,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: tokens.colors.brandJade,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
