import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Coins,
  CreditCard,
  Plus,
  Shield,
} from 'lucide-react-native';
import type {
  EarningsPointDto,
  UpcomingSettlementDto,
  WalletTransactionDto,
} from '@healthcare-system/shared';
import {
  getBankAccount,
  getEarnings,
  getPendingCommissionNotice,
  getUpcomingSettlements,
  getWalletTransactions,
} from './wallet.api';
import { useWalletSummary } from './useWalletSummary';
import { BalanceTiles } from './components/BalanceTiles';
import { EarningsBars } from './components/EarningsBars';
import { TransactionRow } from './components/TransactionRow';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList, MainTabParamList } from '../../navigation/types';

type WalletNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'WalletTab'>,
  NativeStackNavigationProp<ActiveStackParamList>
>;

interface WalletScreenProps {
  navigation: WalletNavProp;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({ navigation }) => {
  const { summary, loading: loadingSummary, refresh: refreshSummary } = useWalletSummary();

  const [bankAccountMasked, setBankAccountMasked] = useState<string>('');
  const [pendingCommission, setPendingCommission] = useState<{
    hasPendingCommission: boolean;
    bookingCode?: string;
    amount?: number;
    hoursRemaining?: number;
    description?: string;
  }>({ hasPendingCommission: false });

  const [earningsPoints, setEarningsPoints] = useState<EarningsPointDto[]>([]);
  const [earningsTotal, setEarningsTotal] = useState<number>(0);
  const [upcomingSettlements, setUpcomingSettlements] = useState<UpcomingSettlementDto[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<WalletTransactionDto[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const [bankRes, commRes, earnRes, upRes, txRes] = await Promise.all([
        getBankAccount(),
        getPendingCommissionNotice(),
        getEarnings('week'),
        getUpcomingSettlements(),
        getWalletTransactions({ limit: 5 }),
      ]);

      if (bankRes.success && bankRes.data?.accountMasked) {
        setBankAccountMasked(bankRes.data.accountMasked);
      }
      setPendingCommission(commRes);

      if (earnRes.success && earnRes.data) {
        setEarningsPoints(earnRes.data.points);
        setEarningsTotal(earnRes.data.totalAmount);
      }

      if (upRes.success && upRes.data) {
        setUpcomingSettlements(upRes.data.slice(0, 3));
      }

      if (txRes.success && txRes.data) {
        setRecentTransactions(txRes.data.items);
      }
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshSummary(), loadData()]);
    setRefreshing(false);
  };

  const handleWithdrawPress = () => {
    navigation.navigate('Withdraw');
  };

  const handleTopUpPress = () => {
    navigation.navigate('Deposit');
  };

  const handlePayCommissionPress = () => {
    navigation.navigate('CommissionPayment', {
      bookingId: (pendingCommission as any).bookingId || pendingCommission.bookingCode,
    });
  };

  if (loadingSummary && !summary) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top']}>
        <ActivityIndicator size="large" color={tokens.colors.brandJade} />
        <Text style={styles.loadingText}>Đang tải ví điều dưỡng...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[tokens.colors.brandJade]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ví của tôi</Text>
          <Text style={styles.headerSubtitle}>
            Ba ngăn tiền minh bạch — Quyết toán, rút tiền và ký quỹ an toàn
          </Text>
        </View>

        {/* Cảnh báo nợ hoa hồng (APP-N4: Ca tiền mặt HC-2026-1057) */}
        {pendingCommission.hasPendingCommission && (
          <View style={styles.commissionBanner}>
            <View style={styles.commissionHeaderRow}>
              <AlertTriangle size={20} color={tokens.colors.alertCrimson} />
              <Text style={styles.commissionTitle}>1 ca chờ nộp hoa hồng</Text>
            </View>
            <Text style={styles.commissionDesc}>
              {pendingCommission.description ||
                `Ca tiền mặt ${pendingCommission.bookingCode} · ${pendingCommission.amount?.toLocaleString(
                  'vi-VN'
                )}đ · Còn ${pendingCommission.hoursRemaining} giờ — quá hạn sẽ tạm khóa nhận ca`}
            </Text>
            <TouchableOpacity
              style={styles.btnPayCommission}
              onPress={handlePayCommissionPress}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Nộp hoa hồng ngay"
            >
              <CreditCard size={18} color="#FFFFFF" />
              <Text style={styles.btnPayCommissionText}>Nộp hoa hồng ngay</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 3 Ngăn số dư */}
        {summary && (
          <BalanceTiles
            summary={summary}
            bankAccountMasked={bankAccountMasked}
            onWithdrawPress={handleWithdrawPress}
            onTopUpDepositPress={handleTopUpPress}
          />
        )}

        {/* Lối tắt thao tác nhanh */}
        <View style={styles.quickActsRow}>
          <TouchableOpacity
            style={styles.quickActBtn}
            onPress={handleTopUpPress}
            activeOpacity={0.75}
          >
            <View style={[styles.quickActIconBox, { backgroundColor: '#E6F2EE' }]}>
              <Plus size={18} color={tokens.colors.brandJade} />
            </View>
            <Text style={styles.quickActText}>Nạp ký quỹ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActBtn}
            onPress={handleWithdrawPress}
            activeOpacity={0.75}
          >
            <View style={[styles.quickActIconBox, { backgroundColor: '#E0F2FE' }]}>
              <ArrowUpRight size={18} color="#0284C7" />
            </View>
            <Text style={styles.quickActText}>Rút tiền</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActBtn}
            onPress={handlePayCommissionPress}
            activeOpacity={0.75}
          >
            <View style={[styles.quickActIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Coins size={18} color={tokens.colors.accentOchre} />
            </View>
            <Text style={styles.quickActText}>Hoa hồng</Text>
          </TouchableOpacity>
        </View>

        {/* Biểu đồ thu nhập tuần */}
        {earningsPoints.length > 0 && (
          <EarningsBars points={earningsPoints} totalAmount={earningsTotal} />
        )}

        {/* Sắp quyết toán (Upcoming Settlements) */}
        {upcomingSettlements.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Clock size={18} color={tokens.colors.accentOchre} />
              <Text style={styles.sectionTitle}>Sắp quyết toán</Text>
            </View>

            {upcomingSettlements.map((item) => (
              <View key={item.bookingCode} style={styles.settleRow}>
                <View style={styles.settleLeft}>
                  <Text style={styles.settleCode}>{item.bookingCode}</Text>
                  <Text style={styles.settleService} numberOfLines={1}>
                    {item.serviceName}
                  </Text>
                  <Text style={styles.settleCountdown}>
                    {item.disputeOpen
                      ? '⚠️ Đang có khiếu nại — đồng hồ quyết toán tạm dừng'
                      : '⏳ Sắp quyết toán vào ví khả dụng'}
                  </Text>
                </View>
                <Text style={styles.settleAmount}>
                  +{item.netAmount.toLocaleString('vi-VN')}đ
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Lịch sử giao dịch gần đây */}
        <View style={styles.sectionCard}>
          <View style={styles.txHeaderRow}>
            <Text style={styles.sectionTitle}>Lịch sử giao dịch</Text>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => navigation.navigate('TransactionHistory')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Xem tất cả lịch sử giao dịch"
            >
              <Text style={styles.seeAllText}>Xem tất cả</Text>
              <ArrowRight size={16} color={tokens.colors.brandJade} />
            </TouchableOpacity>
          </View>

          {recentTransactions.length === 0 ? (
            <Text style={styles.emptyTxText}>Chưa có giao dịch gần đây.</Text>
          ) : (
            recentTransactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.canvas,
  },
  loadingText: {
    fontSize: 15,
    color: tokens.colors.inkSecondary,
    marginTop: 12,
  },
  header: {
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    marginTop: 4,
  },

  /* Commission Banner */
  commissionBanner: {
    backgroundColor: '#FFF9F9',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#F3C2C2',
  },
  commissionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commissionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.alertCrimson,
  },
  commissionDesc: {
    fontSize: 14,
    color: tokens.colors.inkPrimary,
    lineHeight: 20,
    marginTop: 6,
  },
  btnPayCommission: {
    height: 52, // Elder-friendly >= 50dp
    backgroundColor: tokens.colors.alertCrimson,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  btnPayCommissionText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
  },

  /* Quick Actions */
  quickActsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActBtn: {
    flex: 1,
    backgroundColor: tokens.colors.paper,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    gap: 6,
  },
  quickActIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },

  /* Section Cards */
  sectionCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  txHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  emptyTxText: {
    fontSize: 14,
    color: tokens.colors.inkMuted,
    paddingVertical: 12,
    textAlign: 'center',
  },

  /* Settlement rows */
  settleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
    gap: 12,
  },
  settleLeft: {
    flex: 1,
  },
  settleCode: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  settleService: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  settleCountdown: {
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.accentOchre,
    marginTop: 4,
  },
  settleAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.brandJade,
  },
});
