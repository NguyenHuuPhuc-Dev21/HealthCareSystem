import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  RefreshCw,
  RotateCcw,
  Shield,
} from 'lucide-react-native';
import {
  getTxTypeMeta,
  TxType,
  type WalletTransactionDto,
} from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';

interface TransactionRowProps {
  tx: WalletTransactionDto;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({ tx }) => {
  const meta = getTxTypeMeta(tx.type, tx.bookingCode);

  const renderIcon = () => {
    switch (tx.type) {
      case TxType.ESCROW_RELEASE:
        return <CheckCircle2 size={20} color={tokens.colors.brandJade} />;
      case TxType.DEPOSIT_WITHHOLD:
        return <Shield size={20} color="#0284C7" />;
      case TxType.WITHDRAW:
        return <Building2 size={20} color={tokens.colors.brandJade} />;
      case TxType.COMMISSION_PAYMENT:
        return <CreditCard size={20} color={tokens.colors.accentOchre} />;
      case TxType.PENALTY_DEDUCT:
        return <AlertTriangle size={20} color={tokens.colors.alertCrimson} />;
      case TxType.PENALTY_REVERSAL:
        return <RotateCcw size={20} color={tokens.colors.brandJade} />;
      case TxType.TOPUP:
        return <Shield size={20} color={tokens.colors.brandJade} />;
      case TxType.DEPOSIT_REFUND:
        return <RefreshCw size={20} color={tokens.colors.brandJade} />;
      default:
        return <FileText size={20} color={tokens.colors.inkSecondary} />;
    }
  };

  const isNeg = tx.amount < 0 || meta.isNegative;
  const absAmount = Math.abs(tx.amount).toLocaleString('vi-VN');
  const amountStr = isNeg ? `−${absAmount}đ` : `+${absAmount}đ`;

  let formattedDate = tx.createdAt;
  try {
    const d = new Date(tx.createdAt);
    if (!Number.isNaN(d.getTime())) {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      formattedDate = `${day}/${month} · ${hours}:${mins}`;
    }
  } catch {
    // fallback
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconBox,
          isNeg && styles.iconBoxNeg,
          tx.type === TxType.DEPOSIT_WITHHOLD && styles.iconBoxGrace,
        ]}
      >
        {renderIcon()}
      </View>

      <View style={styles.bodyBox}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {meta.title}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{meta.badgeLabel}</Text>
          </View>
        </View>

        <Text style={styles.desc} numberOfLines={2}>
          {tx.description}
        </Text>

        <Text style={styles.date}>{formattedDate}</Text>
      </View>

      <Text
        style={[
          styles.amount,
          isNeg ? styles.amountNeg : styles.amountPos,
        ]}
      >
        {amountStr}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: tokens.colors.brandJadeSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  iconBoxNeg: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  iconBoxGrace: {
    backgroundColor: '#E0F2FE',
  },
  bodyBox: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  badge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  desc: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    color: tokens.colors.inkMuted,
    marginTop: 4,
  },
  amount: {
    fontSize: 15.5,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  amountPos: {
    color: tokens.colors.brandJade,
  },
  amountNeg: {
    color: tokens.colors.alertCrimson,
  },
});
