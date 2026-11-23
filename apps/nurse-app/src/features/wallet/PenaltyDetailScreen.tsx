import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react-native';
import {
  PENALTY_REASON_LABELS,
  type DepositPenaltyDto,
} from '@healthcare-system/shared';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ActiveStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import { getDepositPenalties } from './deposit.api';

type Props = NativeStackScreenProps<ActiveStackParamList, 'PenaltyDetail'>;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${d.getFullYear()} lúc ${d
    .getHours()
    .toString()
    .padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function calculateRemainingAppealTime(deadlineIso: string | null): string {
  if (!deadlineIso) return 'Không áp dụng khiếu nại';
  const diffMs = new Date(deadlineIso).getTime() - Date.now();
  if (diffMs <= 0) return 'Đã hết hạn khiếu nại (quá 3 ngày)';

  const days = Math.floor(diffMs / (24 * 3600 * 1000));
  const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / (3600 * 1000));
  if (days > 0) {
    return `Còn ${days} ngày ${hours} giờ`;
  }
  return `Còn ${hours} giờ`;
}

export const PenaltyDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { transactionId } = route.params;

  const [penalty, setPenalty] = useState<DepositPenaltyDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadDetail = useCallback(async () => {
    try {
      const res = await getDepositPenalties();
      if (res.success && res.data) {
        const found = res.data.find((p) => p.transactionId === transactionId);
        if (found) {
          setPenalty(found);
        } else {
          Alert.alert('Không tìm thấy', 'Khoản trừ không tồn tại.');
          navigation.goBack();
        }
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể tải chi tiết khoản trừ.');
    } finally {
      setLoading(false);
    }
  }, [transactionId, navigation]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={tokens.colors.brandJade} />
          <Text style={styles.loadingText}>Đang tải chi tiết khoản trừ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!penalty) return null;

  const isReversed = penalty.reversed;
  const isAppealed = Boolean(penalty.appealDisputeId);
  const isAppealWindowOpen = Boolean(
    penalty.appealDeadline && new Date(penalty.appealDeadline).getTime() > Date.now()
  );
  const canAppeal = !isReversed && !isAppealed && isAppealWindowOpen;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={24} color={tokens.colors.inkPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Chi tiết khoản trừ SLA</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Thẻ tiền phạt lớn */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconBox}>
            {isReversed ? (
              <ShieldCheck size={28} color="#16A34A" />
            ) : (
              <ShieldAlert size={28} color={tokens.colors.alertCrimson} />
            )}
          </View>
          <Text style={styles.heroTitle}>
            {PENALTY_REASON_LABELS[penalty.reason] || penalty.reason}
          </Text>
          <Text style={[styles.heroAmount, isReversed && styles.heroAmountReversed]}>
            {isReversed ? '+' : '−'}
            {penalty.amount.toLocaleString('vi-VN')}đ
          </Text>
          <Text style={styles.heroSub}>Trừ từ Ví ký quỹ cam kết dịch vụ</Text>
        </View>

        {/* Trạng thái khiếu nại / hoàn lại */}
        {isReversed ? (
          <View style={[styles.statusBanner, styles.bannerSuccess]}>
            <CheckCircle2 size={20} color="#16A34A" />
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerSuccessTitle}>Khoản trừ đã được hoàn lại</Text>
              <Text style={styles.bannerSuccessDesc}>
                Khiếu nại được chấp thuận hoặc vi phạm được hủy bỏ. Số tiền đã được hoàn trả lại
                Ví ký quỹ.
              </Text>
            </View>
          </View>
        ) : isAppealed ? (
          <View style={[styles.statusBanner, styles.bannerWarning]}>
            <Clock size={20} color={tokens.colors.accentOchre} />
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerWarningTitle}>Đang khiếu nại khoản trừ</Text>
              <Text style={styles.bannerWarningDesc}>
                Mã khiếu nại: {penalty.appealDisputeId}. Bộ phận giải quyết tranh chấp đang xử lý
                trong vòng 24–48 giờ.
              </Text>
            </View>
          </View>
        ) : !isAppealWindowOpen ? (
          <View style={[styles.statusBanner, styles.bannerMuted]}>
            <AlertCircle size={20} color={tokens.colors.inkSecondary} />
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerMutedTitle}>Hết thời hạn khiếu nại</Text>
              <Text style={styles.bannerMutedDesc}>
                Quy định khiếu nại khoản trừ SLA có hiệu lực trong vòng 3 ngày kể từ thời điểm phát
                sinh.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Bảng thông tin căn cứ pháp lý & SLA */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Thông tin căn cứ và vi phạm</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Mã giao dịch</Text>
            <Text style={[styles.detailValue, styles.codeText]}>{penalty.transactionId}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Căn cứ điều khoản SLA</Text>
            <Text style={[styles.detailValue, styles.boldValue]}>{penalty.slaRuleRef}</Text>
          </View>

          {penalty.bookingCode ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Mã ca trực liên quan</Text>
              <Text style={[styles.detailValue, styles.codeText]}>{penalty.bookingCode}</Text>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Thời gian phát sinh</Text>
            <Text style={styles.detailValue}>{formatDate(penalty.createdAt)}</Text>
          </View>

          <View style={[styles.detailRow, styles.detailRowLast]}>
            <Text style={styles.detailLabel}>Hạn chót khiếu nại</Text>
            <Text
              style={[
                styles.detailValue,
                isAppealWindowOpen && !isReversed ? styles.deadlineActive : styles.deadlineExpired,
              ]}
            >
              {penalty.appealDeadline
                ? `${formatDate(penalty.appealDeadline)} (${calculateRemainingAppealTime(
                    penalty.appealDeadline
                  )})`
                : 'Không có quyền khiếu nại (theo kết luận tranh chấp)'}
            </Text>
          </View>
        </View>

        {/* Ghi chú diễn giải từ hệ thống */}
        {penalty.note ? (
          <View style={styles.sectionCard}>
            <View style={styles.noteTitleRow}>
              <FileText size={16} color={tokens.colors.brandJade} />
              <Text style={styles.sectionTitle}>Ghi chú giải trình</Text>
            </View>
            <Text style={styles.noteBody}>{penalty.note}</Text>
          </View>
        ) : null}

        {/* Nút Khiếu nại CTA */}
        {canAppeal ? (
          <TouchableOpacity
            style={styles.btnAppeal}
            onPress={() =>
              navigation.navigate('AppealPenalty', {
                transactionId: penalty.transactionId,
              })
            }
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Khiếu nại khoản trừ này"
          >
            <Scale size={20} color="#FFFFFF" />
            <Text style={styles.btnAppealText}>Khiếu nại khoản trừ này</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  backBtn: {
    padding: 6,
  },
  headerBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: tokens.colors.inkSecondary,
  },
  heroCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.lg,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  heroIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: tokens.colors.alertCrimson,
    marginBottom: 6,
  },
  heroAmountReversed: {
    color: '#16A34A',
  },
  heroSub: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
  },
  bannerSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  bannerSuccessTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 2,
  },
  bannerSuccessDesc: {
    fontSize: 13,
    color: '#15803D',
    lineHeight: 18,
  },
  bannerWarning: {
    backgroundColor: tokens.colors.accentOchreSoft,
    borderColor: tokens.colors.accentOchre,
  },
  bannerWarningTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
  },
  bannerWarningDesc: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  bannerMuted: {
    backgroundColor: tokens.colors.subtle,
    borderColor: tokens.colors.borderHairline,
  },
  bannerMutedTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    marginBottom: 2,
  },
  bannerMutedDesc: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    lineHeight: 18,
  },
  bannerTextWrap: {
    flex: 1,
  },
  sectionCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
    gap: 12,
  },
  detailRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  detailLabel: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: tokens.colors.inkPrimary,
    fontWeight: '600',
    flex: 1.5,
    textAlign: 'right',
  },
  boldValue: {
    fontWeight: '800',
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
  },
  deadlineActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  deadlineExpired: {
    color: tokens.colors.inkSecondary,
  },
  noteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  noteBody: {
    fontSize: 14,
    color: tokens.colors.inkPrimary,
    lineHeight: 21,
    backgroundColor: tokens.colors.canvas,
    padding: 12,
    borderRadius: 8,
  },
  btnAppeal: {
    backgroundColor: tokens.colors.brandJade,
    borderRadius: 12,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  btnAppealText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
