import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  AlertTriangle,
  ArrowDownToLine,
  Building2,
  Clock,
  PlusCircle,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react-native';
import {
  getDepositWarningResult,
  type WalletSummaryDto,
} from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';

interface BalanceTilesProps {
  summary: WalletSummaryDto;
  bankAccountMasked?: string;
  onWithdrawPress?: () => void;
  onTopUpDepositPress?: () => void;
}

export const BalanceTiles: React.FC<BalanceTilesProps> = ({
  summary,
  bankAccountMasked = '•••• 6899',
  onWithdrawPress,
  onTopUpDepositPress,
}) => {
  const depositWarning = getDepositWarningResult(summary);

  return (
    <View style={styles.container}>
      {/* 1. SỐ DƯ KHẢ DỤNG */}
      <View style={[styles.tileCard, styles.tileAvailable]}>
        <View style={styles.tileHeaderRow}>
          <Text style={styles.tileLabel}>SỐ DƯ KHẢ DỤNG</Text>
          <Building2 size={18} color={tokens.colors.brandJade} />
        </View>

        <Text style={styles.amountLarge}>
          {summary.availableBalance.toLocaleString('vi-VN')}đ
        </Text>

        <TouchableOpacity
          style={styles.btnWithdraw}
          onPress={onWithdrawPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Rút tiền về ngân hàng"
        >
          <ArrowDownToLine size={20} color="#FFFFFF" />
          <Text style={styles.btnWithdrawText}>
            Rút tiền về ngân hàng
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. ĐANG TẠM GIỮ */}
      <View style={styles.tileCard}>
        <View style={styles.tileSplitRow}>
          <View style={styles.tileSplitLeft}>
            <View style={styles.tileHeaderRow}>
              <Clock size={16} color={tokens.colors.accentOchre} />
              <Text style={styles.tileTitle}>Đang tạm giữ</Text>
            </View>
            <Text style={styles.tileSub}>
              Tiền khách đã trả trước, quyết toán vào ví khả dụng sau 24h
            </Text>
          </View>
          <Text style={styles.amountMedium}>
            {summary.escrowLockedBalance.toLocaleString('vi-VN')}đ
          </Text>
        </View>
      </View>

      {/* 3. VÍ KÝ QUỸ */}
      <View
        style={[
          styles.tileCard,
          depositWarning.status === 'BELOW_MIN' && styles.tileDepositWarning,
          depositWarning.status === 'GRACE' && styles.tileDepositGrace,
        ]}
      >
        <View style={styles.tileSplitRow}>
          <View style={styles.tileSplitLeft}>
            <View style={styles.tileHeaderRow}>
              {depositWarning.status === 'BELOW_MIN' ? (
                <ShieldAlert size={18} color={tokens.colors.alertCrimson} />
              ) : depositWarning.status === 'GRACE' ? (
                <Shield size={18} color="#0284C7" />
              ) : (
                <ShieldCheck size={18} color={tokens.colors.brandJade} />
              )}
              <Text
                style={[
                  styles.tileTitle,
                  depositWarning.status === 'BELOW_MIN' && styles.tileTitleWarning,
                  depositWarning.status === 'GRACE' && styles.tileTitleGrace,
                ]}
              >
                Ví ký quỹ
              </Text>
            </View>
            <Text style={styles.tileSub}>{depositWarning.message}</Text>
          </View>

          <View style={styles.depositAmountWrap}>
            <Text
              style={[
                styles.amountMedium,
                depositWarning.status === 'BELOW_MIN' && styles.amountWarning,
                depositWarning.status === 'GRACE' && styles.amountGrace,
              ]}
            >
              {summary.depositBalance.toLocaleString('vi-VN')}đ
            </Text>
            <Text style={styles.minDepositSub}>
              Mức chuẩn: {summary.minDeposit.toLocaleString('vi-VN')}đ
            </Text>
          </View>
        </View>

        {/* Nút Nạp ký quỹ khi dưới mức tối thiểu */}
        {depositWarning.status === 'BELOW_MIN' && (
          <TouchableOpacity
            style={styles.btnTopUp}
            onPress={onTopUpDepositPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Nạp ký quỹ bổ sung"
          >
            <PlusCircle size={18} color="#FFFFFF" />
            <Text style={styles.btnTopUpText}>Nạp ký quỹ ngay</Text>
          </TouchableOpacity>
        )}

        {/* Thông báo ân hạn */}
        {depositWarning.status === 'GRACE' && (
          <View style={styles.graceBadgeRow}>
            <Text style={styles.graceBadgeText}>
              ● Ân hạn ký quỹ — Tự động trích 30% thu nhập ca chuyển khoản vào ký quỹ
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  tileCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  tileAvailable: {
    backgroundColor: '#F7FEFB',
    borderColor: tokens.colors.brandJadeDark,
    borderWidth: 1.5,
  },
  tileDepositWarning: {
    backgroundColor: '#FFF9F9',
    borderColor: tokens.colors.alertCrimson,
    borderWidth: 1.5,
  },
  tileDepositGrace: {
    backgroundColor: '#F0F9FF',
    borderColor: '#38BDF8',
    borderWidth: 1.5,
  },
  tileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.inkSecondary,
    letterSpacing: 0.5,
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  tileTitleWarning: {
    color: tokens.colors.alertCrimson,
  },
  tileTitleGrace: {
    color: '#0284C7',
  },
  tileSub: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  amountLarge: {
    fontSize: 30,
    fontWeight: '900',
    color: tokens.colors.inkPrimary,
    marginVertical: 8,
  },
  amountMedium: {
    fontSize: 20,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    textAlign: 'right',
  },
  amountWarning: {
    color: tokens.colors.alertCrimson,
  },
  amountGrace: {
    color: '#0284C7',
  },
  tileSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  tileSplitLeft: {
    flex: 1,
  },
  depositAmountWrap: {
    alignItems: 'flex-end',
  },
  minDepositSub: {
    fontSize: 12,
    color: tokens.colors.inkMuted,
    marginTop: 2,
  },
  btnWithdraw: {
    height: 54, // Elder-friendly >= 54dp
    backgroundColor: tokens.colors.brandJade,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  btnWithdrawText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  btnTopUp: {
    height: 48,
    backgroundColor: tokens.colors.alertCrimson,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  btnTopUpText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  graceBadgeRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#BAE6FD',
  },
  graceBadgeText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0284C7',
    lineHeight: 16,
  },
});
