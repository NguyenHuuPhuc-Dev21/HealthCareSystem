import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  QrCode,
  ShieldAlert,
} from 'lucide-react-native';
import type { CommissionDebtDto } from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';

export interface CommissionDebtItemProps {
  debt: CommissionDebtDto;
  onPay: (debt: CommissionDebtDto) => void;
  isPaying?: boolean;
}

interface CountdownState {
  text: string;
  isOverdue: boolean;
  isUrgent: boolean;
}

export function computeCountdown(dueAt: string, status: string, nowMs: number = Date.now()): CountdownState {
  const diffMs = new Date(dueAt).getTime() - nowMs;

  if (status === 'OVERDUE' || diffMs <= 0) {
    const overdueMs = Math.abs(diffMs);
    const overdueHours = Math.floor(overdueMs / (1000 * 3600));
    const overdueMins = Math.floor((overdueMs % (1000 * 3600)) / (1000 * 60));
    const overdueSecs = Math.floor((overdueMs % (1000 * 60)) / 1000);
    return {
      text:
        overdueHours > 0
          ? `${overdueHours}h ${overdueMins}m`
          : `${overdueMins}m ${overdueSecs}s`,
      isOverdue: true,
      isUrgent: true,
    };
  }

  const hours = Math.floor(diffMs / (1000 * 3600));
  const mins = Math.floor((diffMs % (1000 * 3600)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  const isUrgent = diffMs < 2 * 3600 * 1000; // < 2 giờ

  const timeFormatted = `${hours.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return {
    text: timeFormatted,
    isOverdue: false,
    isUrgent,
  };
}

export const CommissionDebtItem: React.FC<CommissionDebtItemProps> = ({
  debt,
  onPay,
  isPaying = false,
}) => {
  const [countdown, setCountdown] = useState<CountdownState>(() =>
    computeCountdown(debt.dueAt, debt.status)
  );

  useEffect(() => {
    if (debt.status === 'PAID') return;

    const timer = setInterval(() => {
      setCountdown(computeCountdown(debt.dueAt, debt.status));
    }, 1000);

    return () => clearInterval(timer);
  }, [debt.dueAt, debt.status]);

  const isOverdue = debt.status === 'OVERDUE' || countdown.isOverdue;
  const isPaid = debt.status === 'PAID';

  const formatVND = (amount: number) => `${amount.toLocaleString('vi-VN')} đ`;

  const formatPaidDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return isoString;
    }
  };

  return (
    <View
      style={[
        styles.card,
        isOverdue && styles.cardOverdue,
        isPaid && styles.cardPaid,
      ]}
    >
      {/* Top Header: Mã ca & Badge trạng thái */}
      <View style={styles.headerRow}>
        <View style={styles.codeWrap}>
          <Text style={styles.bookingCodeText}>{debt.bookingCode}</Text>
          <Text style={styles.cashChipText}>Thu tiền mặt trực tiếp</Text>
        </View>

        {isPaid ? (
          <View style={styles.badgePaid}>
            <CheckCircle2 size={14} color={tokens.colors.brandJadeDark} />
            <Text style={styles.badgePaidText}>Đã nộp hoa hồng</Text>
          </View>
        ) : isOverdue ? (
          <View style={styles.badgeOverdue}>
            <ShieldAlert size={14} color={tokens.colors.alertCrimson} />
            <Text style={styles.badgeOverdueText}>Quá hạn {countdown.text}</Text>
          </View>
        ) : (
          <View
            style={[
              styles.badgePending,
              countdown.isUrgent && styles.badgeUrgent,
            ]}
          >
            <Clock
              size={14}
              color={countdown.isUrgent ? tokens.colors.accentOchre : tokens.colors.inkSecondary}
            />
            <Text
              style={[
                styles.badgePendingText,
                countdown.isUrgent && styles.badgeUrgentText,
              ]}
            >
              Còn {countdown.text}
            </Text>
          </View>
        )}
      </View>

      {/* Tên dịch vụ */}
      <Text style={styles.serviceNameText}>{debt.serviceName}</Text>

      {/* Chi tiết tài chính */}
      <View style={styles.detailsBox}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Giá trị ca (tiền mặt đã nhận)</Text>
          <Text style={styles.detailValueBold}>{formatVND(debt.bookingAmount)}</Text>
        </View>

        <View style={[styles.detailRow, styles.commissionRow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.commissionLabel}>Hoa hồng 15% cần nộp</Text>
          </View>
          <Text
            style={[
              styles.commissionValue,
              isOverdue && { color: tokens.colors.alertCrimson },
            ]}
          >
            {formatVND(debt.commissionAmount)}
          </Text>
        </View>
      </View>

      {/* Ghi chú chính sách */}
      <View style={styles.policyNotice}>
        <AlertCircle size={14} color={tokens.colors.inkMuted} style={{ marginTop: 2 }} />
        <Text style={styles.policyText}>
          Hoa hồng không trừ từ ví khả dụng hay ký quỹ — bạn tự chuyển khoản bằng mã VietQR. Tiền tip
          của người bệnh không tính hoa hồng.
        </Text>
      </View>

      {/* CTA Button hoặc Thông tin đã nộp */}
      {isPaid ? (
        <View style={styles.paidInfoBox}>
          <CheckCircle2 size={16} color={tokens.colors.brandJade} />
          <Text style={styles.paidInfoText}>
            Đã quyết toán lúc {formatPaidDate(debt.paidAt)}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.payButton,
            isOverdue && styles.payButtonOverdue,
            isPaying && { opacity: 0.6 },
          ]}
          disabled={isPaying}
          onPress={() => onPay(debt)}
          activeOpacity={0.8}
        >
          <QrCode size={20} color="#FFFFFF" />
          <Text style={styles.payButtonText}>
            {isPaying ? 'Đang tạo mã VietQR...' : `Nộp qua VietQR (${formatVND(debt.commissionAmount)})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    marginBottom: 14,
    gap: 12,
  },
  cardOverdue: {
    borderColor: tokens.colors.alertCrimson,
    borderWidth: 1.5,
    backgroundColor: '#FFFBFB',
  },
  cardPaid: {
    borderColor: tokens.colors.borderHairline,
    opacity: 0.95,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  codeWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  bookingCodeText: {
    fontFamily: 'monospace',
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    backgroundColor: tokens.colors.canvas,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  cashChipText: {
    fontSize: 12.5,
    color: tokens.colors.inkSecondary,
    fontWeight: '500',
  },
  badgePaid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tokens.colors.brandJadeSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgePaidText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
  },
  badgeOverdue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  badgeOverdueText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: tokens.colors.alertCrimson,
  },
  badgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tokens.colors.canvas,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  badgePendingText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  badgeUrgent: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  badgeUrgentText: {
    color: tokens.colors.accentOchre,
  },
  serviceNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    lineHeight: 23,
  },
  detailsBox: {
    backgroundColor: tokens.colors.canvas,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
  },
  detailValueBold: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  commissionRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
  },
  commissionLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  commissionValue: {
    fontSize: 17,
    fontWeight: '900',
    color: tokens.colors.brandJadeDark,
  },
  policyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 2,
  },
  policyText: {
    flex: 1,
    fontSize: 12.5,
    color: tokens.colors.inkMuted,
    lineHeight: 18,
  },
  payButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: tokens.colors.brandJade,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  payButtonOverdue: {
    backgroundColor: tokens.colors.alertCrimson,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  paidInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: tokens.colors.brandJadeSoft,
    borderRadius: 10,
  },
  paidInfoText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
  },
});
