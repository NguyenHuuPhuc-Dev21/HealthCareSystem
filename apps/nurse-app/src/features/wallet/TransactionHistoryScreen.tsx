import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Filter, Inbox } from 'lucide-react-native';
import type { WalletTransactionDto } from '@healthcare-system/shared';
import { getWalletTransactions } from './wallet.api';
import { TransactionRow } from './components/TransactionRow';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList } from '../../navigation/types';

interface TransactionHistoryScreenProps {
  navigation: NativeStackNavigationProp<ActiveStackParamList, 'TransactionHistory'>;
}

const FILTER_OPTIONS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'SETTLE', label: 'Quyết toán' },
  { key: 'PENALTY', label: 'Phạt vi phạm' },
  { key: 'WITHDRAW', label: 'Rút tiền' },
  { key: 'DEPOSIT', label: 'Ký quỹ' },
];

export const TransactionHistoryScreen: React.FC<TransactionHistoryScreenProps> = ({
  navigation,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const loadTransactions = useCallback(
    async (isRefresh = false, cursor?: string | null) => {
      if (isRefresh) {
        setRefreshing(true);
      } else if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const res = await getWalletTransactions({
          type: activeFilter === 'ALL' ? undefined : activeFilter,
          cursor: cursor ?? undefined,
          limit: 8,
        });

        if (res.success && res.data) {
          if (cursor) {
            setTransactions((prev) => [...prev, ...res.data.items]);
          } else {
            setTransactions(res.data.items);
          }
          setNextCursor(res.data.nextCursor ?? null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [activeFilter]
  );

  useEffect(() => {
    void loadTransactions(false, null);
  }, [loadTransactions]);

  const handleEndReached = () => {
    if (!loadingMore && nextCursor) {
      void loadTransactions(false, nextCursor);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={24} color={tokens.colors.inkPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch sử giao dịch</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Horizontal Scroll / Tabs */}
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_OPTIONS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterListContent}
          renderItem={({ item }) => {
            const isActive = activeFilter === item.key;
            return (
              <TouchableOpacity
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(item.key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Lọc theo ${item.label}`}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Transactions List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={tokens.colors.brandJade} />
          <Text style={styles.loadingText}>Đang tải lịch sử giao dịch...</Text>
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.centerBox}>
          <Inbox size={48} color={tokens.colors.inkMuted} />
          <Text style={styles.emptyTitle}>Chưa có giao dịch nào</Text>
          <Text style={styles.emptySub}>
            Các biến động thu nhập, quyết toán, rút tiền hoặc phạt sẽ hiển thị tại đây.
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TransactionRow tx={item} />}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => void loadTransactions(true, null)}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={tokens.colors.brandJade} />
                <Text style={styles.footerLoaderText}>Đang tải thêm...</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  filterBar: {
    backgroundColor: tokens.colors.paper,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  filterListContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: tokens.colors.brandJade,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: tokens.colors.paper,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: tokens.colors.inkSecondary,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginTop: 14,
  },
  emptySub: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  footerLoaderText: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
  },
});
