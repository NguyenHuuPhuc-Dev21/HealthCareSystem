import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import {
  PENALTY_REASON_LABELS,
  type DepositPenaltyDto,
} from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';

export interface PenaltyItemProps {
  penalty: DepositPenaltyDto;
  onPress: (penalty: DepositPenaltyDto) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

export const PenaltyItem: React.FC<PenaltyItemProps> = ({ penalty, onPress }) => {
  const isReversed = penalty.reversed;
  const isAppealed = Boolean(penalty.appealDisputeId);
  const canAppeal =
    !isReversed &&
    !isAppealed &&
    Boolean(penalty.appealDeadline && new Date(penalty.appealDeadline).getTime() > Date.now());

  const getStatusBadge = () => {
    if (isReversed) {
      return (
        <View style={[styles.badge, styles.badgeSuccess]}>
          <Text style={[styles.badgeText, styles.badgeTextSuccess]}>Đã hoàn lại</Text>
        </View>
      );
    }
    if (isAppealed) {
      return (
        <View style={[styles.badge, styles.badgeWarning]}>
          <Text style={[styles.badgeText, styles.badgeTextWarning]}>Đang khiếu nại</Text>
        </View>
      );
    }
    if (canAppeal) {
      return (
        <View style={[styles.badge, styles.badgeInfo]}>
          <Text style={[styles.badgeText, styles.badgeTextInfo]}>Có thể khiếu nại</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, styles.badgeMuted]}>
        <Text style={[styles.badgeText, styles.badgeTextMuted]}>Hết hạn khiếu nại</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(penalty)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Khoản trừ ${PENALTY_REASON_LABELS[penalty.reason] || penalty.reason}, số tiền ${penalty.amount.toLocaleString('vi-VN')}đ`}
    >
      <View style={styles.topRow}>
        <View style={styles.leftCol}>
          <View style={styles.iconBox}>
            {isReversed ? (
              <ShieldCheck size={18} color="#16A34A" />
            ) : (
              <ShieldAlert size={18} color={tokens.colors.alertCrimson} />
            )}
          </View>
          <View style={styles.titleWrap}>
            <Text style={styles.reasonTitle} numberOfLines={2}>
              {PENALTY_REASON_LABELS[penalty.reason] || penalty.reason}
            </Text>
            <Text style={styles.subMeta}>
              {penalty.slaRuleRef} · {penalty.bookingCode || 'Ca trực'} · {formatDate(penalty.createdAt)}
            </Text>
          </View>
        </View>

        <View style={styles.rightCol}>
          <Text style={[styles.amountText, isReversed && styles.amountReversed]}>
            {isReversed ? '+' : '−'}
            {penalty.amount.toLocaleString('vi-VN')}đ
          </Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        {getStatusBadge()}
        <View style={styles.seeDetailBtn}>
          <Text style={styles.seeDetailText}>Chi tiết</Text>
          <ChevronRight size={15} color={tokens.colors.inkSecondary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    marginTop: 2,
  },
  titleWrap: {
    flex: 1,
  },
  reasonTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    lineHeight: 20,
  },
  subMeta: {
    fontSize: 12.5,
    color: tokens.colors.inkSecondary,
    marginTop: 3,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 15.5,
    fontWeight: '900',
    color: tokens.colors.alertCrimson,
  },
  amountReversed: {
    color: '#16A34A',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.subtle,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  badgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  badgeTextSuccess: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#15803D',
  },
  badgeWarning: {
    backgroundColor: tokens.colors.accentOchreSoft,
  },
  badgeTextWarning: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#92400E',
  },
  badgeInfo: {
    backgroundColor: '#E0F2FE',
  },
  badgeTextInfo: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0369A1',
  },
  badgeMuted: {
    backgroundColor: tokens.colors.subtle,
  },
  badgeTextMuted: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  seeDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeDetailText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
});
