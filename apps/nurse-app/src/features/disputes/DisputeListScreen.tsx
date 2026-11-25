import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Clock,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react-native';
import {
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_STATUS_LABELS,
  DisputeStatus,
  type DisputeDto,
} from '@healthcare-system/shared';
import { StateView } from '../../components/StateView';
import { formatDateTime, formatVND } from '../../lib/formatters';
import type { ActiveStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import { getMyDisputes } from './disputes.api';

type Props = NativeStackScreenProps<ActiveStackParamList, 'DisputeList'>;

function getDisputePriority(d: DisputeDto): number {
  const needsRebuttal =
    d.status === DisputeStatus.OPEN &&
    d.openedBy === 'PATIENT' &&
    !d.nurseRebuttal;
  if (needsRebuttal) return 0;
  if (
    d.status === DisputeStatus.OPEN ||
    d.status === DisputeStatus.UNDER_REVIEW
  ) {
    return 1;
  }
  return 2;
}

export function sortDisputesForNurse(list: DisputeDto[]): DisputeDto[] {
  return [...list].sort((a, b) => {
    const pA = getDisputePriority(a);
    const pB = getDisputePriority(b);
    if (pA !== pB) return pA - pB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export const DisputeListScreen: React.FC<Props> = ({ navigation }) => {
  const [disputes, setDisputes] = useState<DisputeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await getMyDisputes();
      if (res.success && Array.isArray(res.data)) {
        setDisputes(res.data);
      } else {
        setError(res.error?.message || 'Không thể tải danh sách khiếu nại.');
      }
    } catch {
      setError('Lỗi kết nối khi tải danh sách khiếu nại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      void loadData();
    });
    return unsub;
  }, [navigation, loadData]);

  const sorted = useMemo(() => sortDisputesForNurse(disputes), [disputes]);

  const renderStatusPill = (item: DisputeDto) => {
    const isResolvedNurse = item.status === DisputeStatus.RESOLVED_NURSE;
    const isResolvedCustomer = item.status === DisputeStatus.RESOLVED_CUSTOMER;
    const isNeedsRebuttal =
      item.status === DisputeStatus.OPEN &&
      item.openedBy === 'PATIENT' &&
      !item.nurseRebuttal;

    const bg = isNeedsRebuttal
      ? tokens.colors.accentOchreSoft
      : isResolvedNurse
        ? tokens.colors.brandJadeSoft
        : isResolvedCustomer
          ? tokens.colors.alertCrimsonSoft
          : tokens.colors.subtle;

    const fg = isNeedsRebuttal
      ? tokens.colors.accentOchre
      : isResolvedNurse
        ? tokens.colors.brandJadeDark
        : isResolvedCustomer
          ? tokens.colors.alertCrimson
          : tokens.colors.inkSecondary;

    return (
      <View style={[styles.statusPill, { backgroundColor: bg }]}>
        {isNeedsRebuttal ? (
          <Clock size={12} color={fg} />
        ) : isResolvedNurse ? (
          <ShieldCheck size={12} color={fg} />
        ) : isResolvedCustomer ? (
          <AlertCircle size={12} color={fg} />
        ) : (
          <Scale size={12} color={fg} />
        )}
        <Text style={[styles.statusText, { color: fg }]}>
          {DISPUTE_STATUS_LABELS[item.status] || item.status}
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: DisputeDto }) => {
    const isPenaltyAppeal = item.kind === 'PENALTY_APPEAL';
    const isNeedsRebuttal =
      item.status === DisputeStatus.OPEN &&
      item.openedBy === 'PATIENT' &&
      !item.nurseRebuttal;

    return (
      <TouchableOpacity
        style={[styles.card, isNeedsRebuttal && styles.cardUrgent]}
        onPress={() =>
          navigation.navigate('DisputeDetail', { disputeId: item.id })
        }
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <View style={styles.cardTopRow}>
          <View style={styles.kindWrap}>
            {isPenaltyAppeal ? (
              <ShieldAlert size={16} color={tokens.colors.accentOchre} />
            ) : (
              <Scale size={16} color={tokens.colors.brandJade} />
            )}
            <Text style={styles.kindLabel}>
              {isPenaltyAppeal
                ? 'Khiếu nại khoản trừ ký quỹ'
                : `Đơn ${item.bookingCode}`}
            </Text>
          </View>
          {renderStatusPill(item)}
        </View>

        {isPenaltyAppeal ? (
          <View style={styles.penaltyRow}>
            <Text style={styles.penaltyAmount}>
              {item.penaltyAmount ? formatVND(item.penaltyAmount) : '—'}
            </Text>
            <Text style={styles.penaltyCode}> · Đơn {item.bookingCode}</Text>
          </View>
        ) : (
          <Text style={styles.categoryTitle}>
            {DISPUTE_CATEGORY_LABELS[item.category]?.title || item.category}
          </Text>
        )}

        <Text style={styles.desc} numberOfLines={2}>
          {item.description}
        </Text>

        {isNeedsRebuttal && item.rebuttalDueAt ? (
          <View style={styles.dueBanner}>
            <Clock size={14} color={tokens.colors.accentOchre} />
            <Text style={styles.dueText}>
              Hạn phản hồi: {formatDateTime(item.rebuttalDueAt)}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            Mở lúc {formatDateTime(item.createdAt)}
          </Text>
          <ChevronRight size={18} color={tokens.colors.inkSecondary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={22} color={tokens.colors.inkPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextBox}>
          <Text style={styles.headerTitle}>Khiếu nại &amp; phản hồi</Text>
          <Text style={styles.headerSub}>
            Phản hồi bằng chứng và theo dõi phân xử
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.stateWrap}>
          <StateView
            kind="loading"
            title="Đang tải danh sách khiếu nại..."
            message="Vui lòng chờ trong giây lát."
          />
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <StateView
            kind="error"
            title="Không thể tải khiếu nại"
            message={error}
            actionLabel="Thử lại"
            onAction={() => void loadData()}
          />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadData(true)}
              colors={[tokens.colors.brandJade]}
            />
          }
          ListEmptyComponent={
            <StateView
              kind="empty"
              title="Chưa có khiếu nại nào"
              message="Các khiếu nại từ ca trực hoặc khoản trừ ký quỹ sẽ hiển thị tại đây."
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  backBtn: {
    width: tokens.spacing.touchTargetMin,
    height: tokens.spacing.touchTargetMin,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  headerSub: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  stateWrap: {
    padding: 16,
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    padding: 15,
    gap: 8,
  },
  cardUrgent: {
    borderWidth: 1.5,
    borderColor: tokens.colors.accentOchre,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  kindWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  kindLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  penaltyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  penaltyAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: tokens.colors.alertCrimson,
  },
  penaltyCode: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    fontWeight: '600',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  desc: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
  },
  dueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.accentOchreSoft,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dueText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.accentOchre,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
  },
  dateText: {
    fontSize: 12.5,
    color: tokens.colors.inkMuted,
  },
});
