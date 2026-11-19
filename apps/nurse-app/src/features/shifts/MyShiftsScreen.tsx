import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  PlayCircle,
  RotateCcw,
} from 'lucide-react-native';
import {
  ExecutionStatus,
  type MobileShiftSummary,
} from '@healthcare-system/shared';
import { StateView } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList, MainTabParamList } from '../../navigation/types';
import { getMyShifts } from '../active-shift/active-shift.api';
import { ShiftCard } from './components/ShiftCard';

type MyShiftsNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'ShiftsTab'>,
  NativeStackNavigationProp<ActiveStackParamList>
>;

interface MyShiftsScreenProps {
  navigation: MyShiftsNavProp;
}

export const MyShiftsScreen: React.FC<MyShiftsScreenProps> = ({ navigation }) => {
  const { session } = useAuth();
  const user = session?.user;

  const [shifts, setShifts] = useState<MobileShiftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Trạng thái mở/gấp của 3 phần
  const [openInProgress, setOpenInProgress] = useState(true);
  const [openUpcoming, setOpenUpcoming] = useState(true);
  const [openCompleted, setOpenCompleted] = useState(true);

  const fetchShifts = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await getMyShifts();
      if (res.success && Array.isArray(res.data)) {
        setShifts(res.data);
      } else {
        setLoadError(res.error?.message || 'Không thể tải danh sách ca trực.');
      }
    } catch {
      setLoadError('Lỗi kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchShifts();
  }, [fetchShifts]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchShifts();
  }, [fetchShifts]);

  // Phân loại 3 nhóm ca
  const inProgressShifts = useMemo(
    () => shifts.filter((s) => s.executionStatus === ExecutionStatus.IN_PROGRESS),
    [shifts]
  );

  const upcomingShifts = useMemo(
    () =>
      shifts.filter(
        (s) =>
          s.executionStatus === ExecutionStatus.CONFIRMED ||
          s.executionStatus === undefined
      ),
    [shifts]
  );

  const completedShifts = useMemo(
    () =>
      shifts.filter(
        (s) =>
          s.executionStatus === ExecutionStatus.COMPLETED ||
          s.executionStatus === ExecutionStatus.CANCELLED
      ),
    [shifts]
  );

  // Điều hướng
  const handleOpenActiveShift = (shift: MobileShiftSummary) => {
    navigation.navigate('ActiveShift', { shift });
  };

  const handleOpenBriefing = (shift: MobileShiftSummary) => {
    navigation.navigate('ShiftBriefing', { shift });
  };

  const handleOpenCompletedDetail = (shift: MobileShiftSummary) => {
    navigation.navigate('CompletedShiftDetail', { bookingId: shift.bookingId });
  };

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((w) => w[0])
        .slice(-2)
        .join('')
        .toUpperCase()
    : 'DD';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.appTop}>
        <Text style={styles.brandText}>CareNest</Text>
        <View style={styles.topRight}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarMiniText}>{initials}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[tokens.colors.brandJade]}
            tintColor={tokens.colors.brandJade}
          />
        }
      >
        <View style={styles.pageHead}>
          <Text style={styles.pageTitle}>Ca của tôi</Text>
          <Text style={styles.pageSubtitle}>
            Theo dõi ca trực hôm nay, kiểm tra hồ sơ và hoàn tất báo cáo bàn giao lâm sàng.
          </Text>
        </View>

        {loading && !refreshing ? (
          <StateView kind="loading" title="Đang tải danh sách ca trực..." />
        ) : loadError ? (
          <StateView
            kind="error"
            title="Không thể tải danh sách ca trực"
            message={loadError}
            actionLabel="Thử lại"
            onAction={() => {
              setLoading(true);
              void fetchShifts();
            }}
          />
        ) : shifts.length === 0 ? (
          <StateView
            kind="empty"
            title="Chưa có ca nào — xem Việc làm"
            message="Hãy mở Bảng việc làm để tìm và nhận ca chăm sóc người bệnh phù hợp với bạn."
            actionLabel="Mở Bảng việc làm"
            onAction={() => navigation.navigate('JobsTab')}
          />
        ) : (
          <View style={styles.sectionsWrap}>
            {/* 1. Phần Đang thực hiện (In Progress) */}
            {inProgressShifts.length > 0 ? (
              <View style={styles.sectionContainer}>
                <TouchableOpacity
                  style={[styles.sectionHeader, styles.sectionHeaderInProgress]}
                  onPress={() => setOpenInProgress((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <View style={styles.sectionHeaderLeft}>
                    <PlayCircle color={tokens.colors.brandJade} size={18} />
                    <Text style={styles.sectionTitleInProgress}>
                      Đang thực hiện ({inProgressShifts.length})
                    </Text>
                  </View>
                  {openInProgress ? (
                    <ChevronUp color={tokens.colors.brandJade} size={20} />
                  ) : (
                    <ChevronDown color={tokens.colors.brandJade} size={20} />
                  )}
                </TouchableOpacity>

                {openInProgress ? (
                  <View style={styles.cardGroup}>
                    {inProgressShifts.map((shift) => (
                      <ShiftCard
                        key={shift.bookingId}
                        shift={shift}
                        onPress={handleOpenActiveShift}
                        onActionPress={handleOpenActiveShift}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* 2. Phần Sắp tới (Upcoming) */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => setOpenUpcoming((prev) => !prev)}
                activeOpacity={0.8}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Clock color={tokens.colors.accentOchre} size={18} />
                  <Text style={styles.sectionTitle}>
                    Sắp tới ({upcomingShifts.length})
                  </Text>
                </View>
                {openUpcoming ? (
                  <ChevronUp color={tokens.colors.inkSecondary} size={20} />
                ) : (
                  <ChevronDown color={tokens.colors.inkSecondary} size={20} />
                )}
              </TouchableOpacity>

              {openUpcoming ? (
                upcomingShifts.length === 0 ? (
                  <View style={styles.subEmptyBox}>
                    <Text style={styles.subEmptyText}>Không có ca trực nào sắp tới.</Text>
                  </View>
                ) : (
                  <View style={styles.cardGroup}>
                    {upcomingShifts.map((shift) => (
                      <ShiftCard
                        key={shift.bookingId}
                        shift={shift}
                        onPress={handleOpenBriefing}
                        onActionPress={handleOpenBriefing}
                      />
                    ))}
                  </View>
                )
              ) : null}
            </View>

            {/* 3. Phần Đã xong (Completed) */}
            <View style={styles.sectionContainer}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => setOpenCompleted((prev) => !prev)}
                activeOpacity={0.8}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Calendar color={tokens.colors.inkSecondary} size={18} />
                  <Text style={styles.sectionTitle}>
                    Đã xong ({completedShifts.length})
                  </Text>
                </View>
                {openCompleted ? (
                  <ChevronUp color={tokens.colors.inkSecondary} size={20} />
                ) : (
                  <ChevronDown color={tokens.colors.inkSecondary} size={20} />
                )}
              </TouchableOpacity>

              {openCompleted ? (
                completedShifts.length === 0 ? (
                  <View style={styles.subEmptyBox}>
                    <Text style={styles.subEmptyText}>Chưa có ca trực nào đã hoàn tất.</Text>
                  </View>
                ) : (
                  <View style={styles.cardGroup}>
                    {completedShifts.map((shift) => (
                      <ShiftCard
                        key={shift.bookingId}
                        shift={shift}
                        onPress={handleOpenCompletedDetail}
                        onActionPress={handleOpenCompletedDetail}
                      />
                    ))}
                  </View>
                )
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  appTop: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarMini: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  pageHead: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
  },
  sectionsWrap: {
    gap: 16,
  },
  sectionContainer: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: tokens.colors.paper,
  },
  sectionHeaderInProgress: {
    backgroundColor: tokens.colors.brandJadeSoft,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  sectionTitleInProgress: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
  },
  cardGroup: {
    padding: 12,
    backgroundColor: tokens.colors.canvas,
    gap: 4,
  },
  subEmptyBox: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.canvas,
  },
  subEmptyText: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
  },
});
