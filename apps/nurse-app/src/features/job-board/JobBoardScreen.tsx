import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
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
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Info,
  ShieldCheck,
} from 'lucide-react-native';
import {
  NurseTier,
  type DirectInvitation,
  type JobBoardFilter,
  type JobItem,
} from '@healthcare-system/shared';
import { CareNestLogoMark, StateView } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList, MainTabParamList } from '../../navigation/types';
import {
  acceptDirectInvite,
  acceptJob,
  declineDirectInvite,
  getDepositStatus,
  getDirectInvitations,
  getJobBoard,
} from './job-board.api';
import { FilterChips } from './components/FilterChips';
import { DirectInviteCard } from './components/DirectInviteCard';
import { JobCard } from './components/JobCard';

type JobBoardNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'JobsTab'>,
  NativeStackNavigationProp<ActiveStackParamList>
>;

interface JobBoardScreenProps {
  navigation: JobBoardNavProp;
}

export const JobBoardScreen: React.FC<JobBoardScreenProps> = ({ navigation }) => {
  const { session } = useAuth();
  const profile = session?.profile;
  const nurseTier = profile?.tier ?? NurseTier.TIER_1_BASIC;
  const isTier2 = nurseTier === NurseTier.TIER_2_SPECIALIST;

  const [activeFilter, setActiveFilter] = useState<JobBoardFilter>('all');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [directInvite, setDirectInvite] = useState<DirectInvitation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ADR-0004 states
  const [depositGraceActive, setDepositGraceActive] = useState<boolean>(false);
  const [graceShiftsRemaining, setGraceShiftsRemaining] = useState<number>(0);
  const [isAccountClosing, setIsAccountClosing] = useState<boolean>(false);
  const [depositBalance, setDepositBalance] = useState<number>(300000);
  const [expiredInviteNotice, setExpiredInviteNotice] = useState<string | null>(null);

  const fetchData = useCallback(
    async (filter: JobBoardFilter = activeFilter) => {
      setErrorMsg(null);
      try {
        const [jobsRes, inviteRes, depositRes] = await Promise.all([
          getJobBoard(filter),
          getDirectInvitations(),
          getDepositStatus(),
        ]);

        if (jobsRes.success) {
          setJobs(jobsRes.data);
        } else {
          setErrorMsg(jobsRes.error?.message || 'Không thể tải danh sách việc làm.');
        }

        if (inviteRes.success) {
          setDirectInvite(inviteRes.data);
        }

        if (depositRes.success && depositRes.data) {
          setDepositGraceActive(depositRes.data.depositGraceActive);
          setGraceShiftsRemaining(depositRes.data.graceShiftsRemaining);
          setIsAccountClosing(depositRes.data.isAccountClosing);
          setDepositBalance(depositRes.data.depositBalance);
        }
      } catch {
        setErrorMsg('Lỗi kết nối khi tải dữ liệu việc làm.');
      }
    },
    [activeFilter]
  );

  useEffect(() => {
    setLoading(true);
    void fetchData(activeFilter).finally(() => setLoading(false));
  }, [activeFilter, fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(activeFilter);
    setRefreshing(false);
  };

  const handleFilterChange = (filter: JobBoardFilter) => {
    setActiveFilter(filter);
  };

  const handleDirectInviteAccept = async (bookingId: string) => {
    try {
      const res = await acceptDirectInvite(bookingId, nurseTier, depositBalance);
      if (res.success) {
        setDirectInvite(null);
        Alert.alert(
          'Đã nhận lời mời thành công!',
          res.message || 'Ca trực đã được ghi nhận. Bạn có thể xem ngay ở mục Ca trực.',
          [
            {
              text: 'Xem Ca trực',
              onPress: () => navigation.navigate('ShiftsTab'),
            },
          ]
        );
      } else {
        handleClaimError(res.errorCode, res.message);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể nhận lời mời lúc này.');
    }
  };

  const handleDirectInviteDecline = (bookingId: string) => {
    Alert.alert(
      'Từ chối lời mời',
      'Bạn có chắc chắn muốn từ chối lời mời này? Hệ thống sẽ chuyển ca cho điều dưỡng khác.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Từ chối',
          style: 'destructive',
          onPress: async () => {
            try {
              await declineDirectInvite(bookingId, 'Điều dưỡng bận');
              setDirectInvite(null);
            } catch {
              Alert.alert('Lỗi', 'Không thể từ chối lời mời lúc này.');
            }
          },
        },
      ]
    );
  };

  const handleDirectInviteExpire = () => {
    setDirectInvite(null);
    setExpiredInviteNotice('Lời mời đã chuyển cho điều dưỡng khác do quá 15 phút.');
  };

  const handleClaimError = (errorCode?: string, customMessage?: string) => {
    if (errorCode === 'DEPOSIT_BELOW_MIN') {
      Alert.alert(
        'Số dư ký quỹ chưa đủ',
        customMessage || 'Số dư ví ký quỹ dưới mức tối thiểu 300.000đ. Vui lòng nạp thêm để nhận ca.',
        [
          { text: 'Đóng', style: 'cancel' },
          {
            text: 'Nạp ký quỹ',
            onPress: () => navigation.navigate('ProfileTab'),
          },
        ]
      );
    } else if (errorCode === 'DEPOSIT_GRACE_CASH_NOT_ALLOWED') {
      Alert.alert(
        'Không thể nhận ca tiền mặt',
        'Ca tiền mặt cần ký quỹ đủ 300.000đ. Trong giai đoạn làm quen bạn nhận được ca chuyển khoản.',
        [
          { text: 'Đóng', style: 'cancel' },
          {
            text: 'Nạp ký quỹ (A10)',
            onPress: () => navigation.navigate('ProfileTab'),
          },
        ]
      );
    } else if (errorCode === 'DEPOSIT_GRACE_EXHAUSTED') {
      Alert.alert(
        'Hết hạn làm quen',
        'Đã dùng hết 3 ca làm quen / hết 30 ngày, nạp thêm để nhận tiếp.'
      );
    } else if (errorCode === 'ACCOUNT_CLOSING') {
      Alert.alert('Ngừng hợp tác', 'Bạn đã yêu cầu ngừng hợp tác nên không thể nhận ca mới.');
    } else if (errorCode === 'TIER_NOT_ALLOWED' || errorCode === 'TIER_MISMATCH') {
      Alert.alert('Chưa đủ điều kiện', 'Dịch vụ xâm lấn yêu cầu Điều dưỡng Cấp 2 có GPHN còn hạn.');
    } else if (errorCode === 'SCHEDULE_CONFLICT') {
      Alert.alert('Trùng lịch ca trực', 'Thời gian ca này trùng với ca trực hoặc lịch bận đã đăng ký.');
    } else if (errorCode === 'JOB_ALREADY_TAKEN' || errorCode === 'ALREADY_CLAIMED') {
      Alert.alert('Ca đã có người nhận', 'Ca làm việc này vừa được một điều dưỡng khác tiếp nhận (First-come claim)!');
    } else {
      Alert.alert('Không thể nhận ca', customMessage || 'Vui lòng kiểm tra lại điều kiện nhận ca.');
    }
  };

  const handleJobCardAccept = (job: JobItem) => {
    const isLocked = Boolean(job.isInvasive && !isTier2);
    if (isLocked) {
      Alert.alert(
        'Ca bị khóa theo cấp bậc',
        'Dịch vụ xâm lấn yêu cầu Điều dưỡng Cấp 2 có Giấy phép hành nghề còn hạn.'
      );
      return;
    }

    const penaltyPercent = job.cancellationPenaltyPercent ?? 20;
    const penaltyAmount = Math.round((job.totalAmount * penaltyPercent) / 100);

    Alert.alert(
      'Xác nhận nhận ca trực',
      `Bạn có chắc chắn muốn nhận ca "${job.serviceName}"?\n\nLưu ý chính sách cam kết: Hủy ca sau khi nhận sẽ bị trừ ${penaltyPercent}% (${penaltyAmount.toLocaleString('vi-VN')}đ) vào ví ký quỹ.`,
      [
        { text: 'Suy nghĩ thêm', style: 'cancel' },
        {
          text: 'Đồng ý nhận ca',
          onPress: async () => {
            try {
              const res = await acceptJob(job.id, nurseTier, depositBalance);
              if (res.success) {
                // Refresh list
                void fetchData(activeFilter);
                Alert.alert(
                  'Nhận ca thành công!',
                  res.message || 'Ca trực đã được ghi nhận. Bạn có thể xem ngay ở mục Ca trực.',
                  [
                    {
                      text: 'Xem Ca trực',
                      onPress: () => navigation.navigate('ShiftsTab'),
                    },
                  ]
                );
              } else {
                handleClaimError(res.errorCode, res.message);
              }
            } catch {
              Alert.alert('Lỗi', 'Không thể kết nối máy chủ để nhận ca.');
            }
          },
        },
      ]
    );
  };

  // Render Account Closing State (ADR-0004)
  if (isAccountClosing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <CareNestLogoMark size={28} />
            <Text style={styles.brandName}>CareNest</Text>
          </View>
        </View>
        <StateView
          kind="empty"
          title="Bạn đã yêu cầu ngừng hợp tác"
          message="Bạn đã yêu cầu ngừng hợp tác nên không thể nhận ca mới. Vui lòng kiểm tra tiến trình hoàn ký quỹ tại mục Tài khoản."
          actionLabel="Đến trang Tài khoản"
          onAction={() => navigation.navigate('ProfileTab')}
        />
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      {/* Brand & Title */}
      <View style={styles.headerTop}>
        <View style={styles.brandRow}>
          <CareNestLogoMark size={26} />
          <Text style={styles.brandName}>CareNest</Text>
        </View>
        <View style={styles.tierTag}>
          <ShieldCheck size={14} color={tokens.colors.brandJade} />
          <Text style={styles.tierTagText}>
            {isTier2 ? 'Điều dưỡng Cấp 2' : 'Điều dưỡng Cấp 1'}
          </Text>
        </View>
      </View>

      <View style={styles.titleArea}>
        <Text style={styles.screenTitle}>Việc làm gần bạn</Text>
        <Text style={styles.screenSubtitle}>
          Trong bán kính 5 km · {isTier2 ? 'Đầy đủ quyền nhận ca xâm lấn Cấp 2' : 'Chỉ nhận ca chăm sóc cơ bản Cấp 1'}
        </Text>
      </View>

      {/* ADR-0004: Grace period explanation banner */}
      {depositGraceActive && (
        <View style={styles.graceHeaderBanner}>
          <CheckCircle2 size={18} color="#065F46" />
          <Text style={styles.graceHeaderBannerText}>
            Đang làm quen: còn {graceShiftsRemaining} ca, chỉ hiện ca chuyển khoản
          </Text>
        </View>
      )}

      {/* Notice if an invitation just expired */}
      {expiredInviteNotice && (
        <View style={styles.expiredBanner}>
          <Info size={16} color="#4B5563" />
          <Text style={styles.expiredBannerText}>{expiredInviteNotice}</Text>
        </View>
      )}

      {/* Direct Invitation Card if present */}
      {directInvite && (
        <DirectInviteCard
          invite={directInvite}
          onAccept={handleDirectInviteAccept}
          onDecline={handleDirectInviteDecline}
          onExpire={handleDirectInviteExpire}
        />
      )}

      {/* Filter Chips Bar */}
      <FilterChips
        activeFilter={activeFilter}
        onSelectFilter={handleFilterChange}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <StateView
            kind="loading"
            title="Đang tìm việc làm phù hợp"
            message="Vui lòng chờ CareNest quét danh sách ca đặt trước..."
          />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[tokens.colors.brandJade]}
              tintColor={tokens.colors.brandJade}
            />
          }
          renderItem={({ item }) => {
            const isLocked = Boolean(item.isInvasive && !isTier2);
            return (
              <JobCard
                job={item}
                isLocked={isLocked}
                depositGraceActive={depositGraceActive}
                onPress={(targetJob) =>
                  navigation.navigate('JobDetail', { jobId: targetJob.id })
                }
                onAccept={handleJobCardAccept}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <StateView
                kind="empty"
                title="Chưa có ca phù hợp"
                message={
                  errorMsg ||
                  'Hiện tại chưa có ca đặt trước nào phù hợp với bộ lọc này. Bạn có thể kéo xuống để cập nhật lại hoặc chọn bộ lọc khác.'
                }
              />
            </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  headerBlock: {
    paddingBottom: 4,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: tokens.colors.brandJade,
    letterSpacing: -0.5,
  },
  tierTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  tierTagText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  titleArea: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
  },
  graceHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  graceHeaderBannerText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  expiredBannerText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#4B5563',
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
});
