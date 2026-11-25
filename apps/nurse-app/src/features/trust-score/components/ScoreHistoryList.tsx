import React, { useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { History, TrendingDown, TrendingUp } from 'lucide-react-native';
import type { TrustScoreHistoryItem } from '@healthcare-system/shared';
import { formatDateTime } from '../../../lib/formatters';
import { tokens } from '../../../styles/tokens';
import { getTrustScoreReasonLabel } from '../trust-score-labels';

export interface ScoreHistoryListProps {
  history: TrustScoreHistoryItem[];
}

type HistoryFilter = 'all' | 'positive' | 'negative';

function formatSignedDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${Math.abs(delta)}`;
  return '0';
}

export const ScoreHistoryList: React.FC<ScoreHistoryListProps> = ({ history }) => {
  const [filter, setFilter] = useState<HistoryFilter>('all');

  const positiveCount = useMemo(
    () => history.filter((item) => item.delta > 0).length,
    [history]
  );
  const negativeCount = useMemo(
    () => history.filter((item) => item.delta < 0).length,
    [history]
  );

  const filtered = useMemo(() => {
    if (filter === 'positive') return history.filter((item) => item.delta > 0);
    if (filter === 'negative') return history.filter((item) => item.delta < 0);
    return history;
  }, [history, filter]);

  const renderItem = ({ item, index }: { item: TrustScoreHistoryItem; index: number }) => {
    const isPositive = item.delta > 0;
    const isMild = item.delta < 0 && item.delta >= -5;
    const accentColor = isPositive
      ? tokens.colors.success
      : isMild
        ? tokens.colors.accentOchre
        : tokens.colors.alertCrimson;
    const softBg = isPositive
      ? tokens.colors.brandJadeSoft
      : isMild
        ? tokens.colors.accentOchreSoft
        : tokens.colors.alertCrimsonSoft;

    return (
      <View
        style={[
          styles.itemRow,
          index === filtered.length - 1 && styles.itemRowLast,
        ]}
      >
        <View style={[styles.iconBadge, { backgroundColor: softBg }]}>
          {isPositive ? (
            <TrendingUp size={18} color={accentColor} />
          ) : (
            <TrendingDown size={18} color={accentColor} />
          )}
        </View>
        <View style={styles.itemBody}>
          <Text style={styles.reasonText}>
            {getTrustScoreReasonLabel(item.reason)}
          </Text>
          <Text style={styles.metaText}>
            {formatDateTime(item.createdAt)}
            {item.bookingCode ? ` · ${item.bookingCode}` : ''}
          </Text>
          {item.note ? <Text style={styles.noteText}>{item.note}</Text> : null}
        </View>
        <Text style={[styles.deltaText, { color: accentColor }]}>
          {formatSignedDelta(item.delta)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Lịch sử thay đổi điểm</Text>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{history.length} biến động</Text>
        </View>
      </View>

      {history.length > 0 ? (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.filterText,
                filter === 'all' && styles.filterTextActive,
              ]}
            >
              Tất cả ({history.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === 'positive' && styles.filterChipPositive,
            ]}
            onPress={() => setFilter('positive')}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.filterText,
                filter === 'positive' && styles.filterTextActive,
              ]}
            >
              Cộng điểm (+{positiveCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === 'negative' && styles.filterChipNegative,
            ]}
            onPress={() => setFilter('negative')}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.filterText,
                filter === 'negative' && styles.filterTextActive,
              ]}
            >
              Bị trừ (−{negativeCount})
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {history.length === 0 ? (
        <View style={styles.emptyBox}>
          <History size={32} color={tokens.colors.inkMuted} />
          <Text style={styles.emptyTitle}>Chưa có biến động điểm nào</Text>
          <Text style={styles.emptySub}>
            Các thay đổi sau ca hoàn tất hoặc sự cố sẽ hiển thị tại đây.
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.emptyFilter}>
          Không có biến động nào phù hợp với bộ lọc đã chọn.
        </Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          scrollEnabled={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  title: {
    fontSize: 17.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  countPill: {
    backgroundColor: tokens.colors.subtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  countPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.subtle,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.brandJade,
  },
  filterChipPositive: {
    backgroundColor: tokens.colors.success,
  },
  filterChipNegative: {
    backgroundColor: tokens.colors.alertCrimson,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  itemRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemBody: {
    flex: 1,
  },
  reasonText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 2,
  },
  metaText: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginBottom: 2,
  },
  noteText: {
    fontSize: 13.5,
    color: tokens.colors.inkMuted,
    lineHeight: 19,
  },
  deltaText: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    paddingTop: 2,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginTop: 4,
  },
  emptySub: {
    fontSize: 14,
    color: tokens.colors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyFilter: {
    textAlign: 'center',
    fontSize: 14,
    color: tokens.colors.inkMuted,
    paddingVertical: 16,
  },
});
