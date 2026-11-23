import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle, Check, CheckCircle2, Clock, Sparkles } from 'lucide-react-native';
import type { DepositStatusDto } from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';

export interface GraceProgressCardProps {
  status: DepositStatusDto & { totalWithheld?: number };
}

function calculateDaysLeft(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 3600 * 1000)));
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Chưa xác định';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${d.getFullYear()}`;
}

export const GraceProgressCard: React.FC<GraceProgressCardProps> = ({ status }) => {
  const { grace, minDeposit, shortfall, canAcceptCash, totalWithheld = 0 } = status;

  if (!grace.active && shortfall <= 0) {
    return null;
  }

  const remainingShifts = Math.max(0, grace.maxShifts - grace.shiftsUsed);
  const daysLeft = calculateDaysLeft(grace.expiresAt);
  const isExpired = !grace.active && shortfall > 0;

  if (isExpired) {
    return (
      <View style={[styles.card, styles.cardExpired]}>
        <View style={styles.headerRow}>
          <AlertCircle size={22} color={tokens.colors.accentOchre} />
          <Text style={styles.titleExpired}>Giai đoạn làm quen đã kết thúc</Text>
        </View>
        <Text style={styles.descExpired}>
          Bạn đã dùng hết {grace.maxShifts} ca làm quen hoặc đã quá thời hạn 30 ngày. Vui lòng nạp thêm{' '}
          <Text style={styles.boldText}>{shortfall.toLocaleString('vi-VN')}đ</Text> để tiếp tục nhận ca
          mới. Các ca đã xác nhận từ trước vẫn được giữ nguyên.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.cardGrace]}>
      <View style={styles.headerRowBetween}>
        <View style={styles.headerLeft}>
          <Sparkles size={20} color="#0284C7" />
          <Text style={styles.titleGrace}>Giai đoạn làm quen (Ân hạn ký quỹ)</Text>
        </View>
        <View style={styles.badgeGrace}>
          <Text style={styles.badgeGraceText}>
            {grace.shiftsUsed} / {grace.maxShifts} ca
          </Text>
        </View>
      </View>

      <Text style={styles.descGrace}>
        Bạn đang trong giai đoạn làm quen: còn nhận được{' '}
        <Text style={styles.boldText}>{remainingShifts} ca chuyển khoản</Text>, đến hết ngày{' '}
        <Text style={styles.boldText}>{formatDate(grace.expiresAt)}</Text> (còn {daysLeft} ngày). Mỗi ca
        hoàn thành, hệ thống tự động giữ lại{' '}
        <Text style={styles.boldText}>{Math.round(grace.withholdRate * 100)}% thực nhận</Text> vào ký quỹ
        cho tới khi tích lũy đủ {minDeposit.toLocaleString('vi-VN')}đ.
      </Text>

      {/* 3 Chấm tròn ca ân hạn theo yêu cầu A10 */}
      <View style={styles.dotsSection}>
        <Text style={styles.dotsLabel}>Tiến trình ca làm quen:</Text>
        <View style={styles.dotsRow}>
          {Array.from({ length: grace.maxShifts }).map((_, idx) => {
            const isUsed = idx < grace.shiftsUsed;
            const isCurrent = idx === grace.shiftsUsed;
            return (
              <View key={idx} style={styles.dotCol}>
                <View
                  style={[
                    styles.circleDot,
                    isUsed && styles.circleDotFilled,
                    isCurrent && styles.circleDotCurrent,
                  ]}
                  accessibilityLabel={`Ca ${idx + 1}: ${isUsed ? 'Đã dùng' : 'Còn lại'}`}
                >
                  {isUsed ? (
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <Text style={[styles.circleDotNum, isCurrent && styles.circleDotNumCurrent]}>
                      {idx + 1}
                    </Text>
                  )}
                </View>
                <Text style={[styles.dotText, isUsed && styles.dotTextFilled]}>
                  {isUsed ? 'Đã trực' : isCurrent ? 'Ca tiếp' : `Ca ${idx + 1}`}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Thông số chi tiết */}
      <View style={styles.footerRow}>
        <View style={styles.metaItem}>
          <CheckCircle2 size={15} color="#0284C7" />
          <Text style={styles.metaText}>
            Đã giữ lại: <Text style={styles.boldText}>{(totalWithheld || status.depositBalance).toLocaleString('vi-VN')}đ</Text>
          </Text>
        </View>

        <View style={styles.metaItem}>
          <Clock size={15} color="#0284C7" />
          <Text style={styles.metaText}>
            Hạn chót: <Text style={styles.boldText}>{formatDate(grace.expiresAt)}</Text>
          </Text>
        </View>

        {!canAcceptCash && (
          <Text style={styles.warnCash}>
            ⚠️ Ca tiền mặt cần ký quỹ đủ {minDeposit.toLocaleString('vi-VN')}đ.
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radii.lg,
    padding: 18,
    borderWidth: 1.5,
  },
  cardExpired: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  cardGrace: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  headerRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  titleExpired: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#92400E',
  },
  descExpired: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  titleGrace: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0369A1',
    flexShrink: 1,
  },
  badgeGrace: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  badgeGraceText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369A1',
  },
  descGrace: {
    fontSize: 14,
    color: '#0C4A6E',
    lineHeight: 21,
  },
  boldText: {
    fontWeight: '800',
  },
  dotsSection: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  dotsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  dotCol: {
    alignItems: 'center',
    gap: 4,
  },
  circleDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleDotFilled: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  circleDotCurrent: {
    borderColor: '#0284C7',
    borderWidth: 2.5,
  },
  circleDotNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  circleDotNumCurrent: {
    color: '#0284C7',
  },
  dotText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  dotTextFilled: {
    color: '#0284C7',
    fontWeight: '700',
  },
  footerRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#BAE6FD',
    borderStyle: 'dashed',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13.5,
    color: '#075985',
  },
  warnCash: {
    fontSize: 13,
    color: '#B45309',
    fontWeight: '700',
    marginTop: 2,
  },
});
