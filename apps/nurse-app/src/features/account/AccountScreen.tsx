import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Award,
  Calendar,
  ChevronRight,
  FileText,
  LogOut,
  ShieldCheck,
  Star,
  Type,
  User,
} from 'lucide-react-native';
import { DocType, NurseTier, VerificationStatus } from '@healthcare-system/shared';
import { AppButton, StatusBadge } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { formatMaskedPhone } from '../../lib/formatters';
import { IS_DEV } from '../../lib/hardware-providers';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList, MainTabParamList } from '../../navigation/types';
import { calculateGphnDaysRemaining } from '../credentials/credentials.api';

type AccountNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'ProfileTab'>,
  NativeStackNavigationProp<ActiveStackParamList>
>;

interface AccountScreenProps {
  navigation: AccountNavProp;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({ navigation }) => {
  const { session, logout, enterDevZone } = useAuth();
  const profile = session?.profile;
  const user = session?.user;
  const credentials = session?.credentials ?? [];

  const [largeFont, setLargeFont] = useState(false);

  const isTier2 = profile?.tier === NurseTier.TIER_2_SPECIALIST;
  const isRetired = Boolean(profile?.is_retired_medical_staff);
  const trustScore = profile?.trust_score ?? 100;
  const ratingAvg = profile?.rating_avg ?? 0;

  const gphnCred = credentials.find((c) => c.doc_type === DocType.GPHN);
  const hasPendingGphn = credentials.some(
    (c) => c.doc_type === DocType.GPHN && c.verification_status === VerificationStatus.PENDING
  );
  const expiryDate = profile?.gphn_expiry_date || gphnCred?.expiry_date;
  const daysRemaining = calculateGphnDaysRemaining(expiryDate);

  const getGphnSubText = (): string => {
    if (hasPendingGphn) {
      return 'GPHN mới vừa nộp — Đang chờ duyệt';
    }
    if (daysRemaining === null) {
      return 'Chưa có GPHN — Hoạt động ở Cấp 1';
    }
    if (daysRemaining <= 0) {
      return 'Đã hết hạn — Bấm để nộp GPHN mới';
    }
    return `Hết hạn ${expiryDate} — còn ${daysRemaining} ngày`;
  };

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản CareNest?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: () => {
            void logout();
          },
        },
      ]
    );
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
      {/* Top Bar per APP-N5 */}
      <View style={styles.appTop}>
        <View style={styles.brandRow}>
          <Text style={styles.brandText}>CareNest</Text>
        </View>
        <View style={styles.topRight}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarMiniText}>{initials}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarLg}>
            <Text style={styles.avatarLgText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.userName, largeFont && styles.userNameLarge]}>
              {user?.full_name || 'Điều dưỡng CareNest'}
            </Text>
            <Text style={styles.userPhone}>
              {formatMaskedPhone(user?.phone || '') || '0905 ••• 123'} · Đà Nẵng
            </Text>
          </View>
        </View>

        {/* Chips Row per APP-N5 */}
        <View style={styles.chipsRow}>
          <StatusBadge
            label={isTier2 ? 'Cấp 2' : 'Cấp 1'}
            tone={isTier2 ? 'jade' : 'neutral'}
          />
          <View style={styles.chipJade}>
            <ShieldCheck color={tokens.colors.brandJade} size={14} />
            <Text style={styles.chipJadeText}>TrustScore {trustScore}/100</Text>
          </View>
          {ratingAvg > 0 ? (
            <View style={styles.chipAmber}>
              <Star color={tokens.colors.accentOchre} size={14} />
              <Text style={styles.chipAmberText}>★ {ratingAvg.toFixed(1)}</Text>
            </View>
          ) : null}
          {isRetired ? (
            <View style={styles.chipBadge}>
              <Award color={tokens.colors.brandJadeDark} size={14} />
              <Text style={styles.chipBadgeText}>Cán bộ y tế nghỉ hưu</Text>
            </View>
          ) : null}
          <View style={styles.chipJade}>
            <Text style={styles.chipJadeText}>● Sẵn sàng nhận ca</Text>
          </View>
        </View>

        {/* Menu List per APP-N5 */}
        <View style={styles.menuCard}>
          {/* 1. Giấy tờ & GPHN */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Credentials')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Giấy tờ và Giấy phép hành nghề"
          >
            <View style={styles.menuIconBox}>
              <FileText color={tokens.colors.brandJade} size={22} />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={[styles.menuTitle, largeFont && styles.menuTitleLarge]}>
                Giấy tờ &amp; GPHN
              </Text>
              <Text
                style={[
                  styles.menuSub,
                  daysRemaining !== null && daysRemaining <= 0 && styles.menuSubRed,
                  daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 30 && styles.menuSubAmber,
                ]}
              >
                {getGphnSubText()}
              </Text>
            </View>
            <ChevronRight color={tokens.colors.inkSecondary} size={20} />
          </TouchableOpacity>

          {/* 2. Lịch rảnh & ngày nghỉ */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('ScheduleTab')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Lịch rảnh và ngày nghỉ"
          >
            <View style={styles.menuIconBox}>
              <Calendar color={tokens.colors.brandJade} size={22} />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={[styles.menuTitle, largeFont && styles.menuTitleLarge]}>
                Lịch rảnh &amp; ngày nghỉ
              </Text>
              <Text style={styles.menuSub}>Đăng ký khung giờ trực hằng tuần</Text>
            </View>
            <ChevronRight color={tokens.colors.inkSecondary} size={20} />
          </TouchableOpacity>

          {/* 3. Cỡ chữ lớn Toggle */}
          <View style={styles.menuItem}>
            <View style={styles.menuIconBox}>
              <Type color={tokens.colors.brandJade} size={22} />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={[styles.menuTitle, largeFont && styles.menuTitleLarge]}>
                Cỡ chữ lớn
              </Text>
              <Text style={styles.menuSub}>Tăng kích thước văn bản hỗ trợ đọc</Text>
            </View>
            <Switch
              value={largeFont}
              onValueChange={setLargeFont}
              trackColor={{ false: tokens.colors.borderHairline, true: tokens.colors.brandJade }}
              thumbColor={tokens.colors.paper}
              accessibilityLabel="Bật tắt cỡ chữ lớn"
            />
          </View>

          {/* 4. Đăng xuất */}
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemDanger]}
            onPress={handleLogout}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Đăng xuất khỏi tài khoản"
          >
            <View style={[styles.menuIconBox, styles.menuIconBoxDanger]}>
              <LogOut color={tokens.colors.alertCrimson} size={22} />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={[styles.menuTitleDanger, largeFont && styles.menuTitleLarge]}>
                Đăng xuất
              </Text>
            </View>
            <ChevronRight color={tokens.colors.alertCrimson} size={20} />
          </TouchableOpacity>
        </View>

        {/* DEV Navigation Testing Box */}
        {IS_DEV ? (
          <View style={styles.devCard}>
            <Text style={styles.devCardTitle}>[DEV] Kiểm thử chuyển vùng tài khoản</Text>
            <View style={styles.devStack}>
              <AppButton
                label="[DEV] Chuyển vùng Onboarding"
                variant="secondary"
                onPress={() => void enterDevZone('onboarding')}
              />
              <AppButton
                label="[DEV] Chuyển vùng Chờ duyệt"
                variant="secondary"
                onPress={() => void enterDevZone('pending')}
              />
              <AppButton
                label="[DEV] Chuyển vùng Bị khóa"
                variant="secondary"
                onPress={() => void enterDevZone('locked')}
              />
            </View>
          </View>
        ) : null}
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingBottom: 36,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  avatarLg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLgText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 19,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 3,
  },
  userNameLarge: {
    fontSize: 22,
  },
  userPhone: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  chipJade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tokens.colors.brandJadeSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radii.pill,
  },
  chipJadeText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
  },
  chipAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.accentOchreSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radii.pill,
  },
  chipAmberText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.accentOchre,
  },
  chipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radii.pill,
  },
  chipBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  menuCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
    minHeight: tokens.spacing.touchTargetMin,
  },
  menuItemDanger: {
    borderBottomWidth: 0,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.colors.brandJadeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconBoxDanger: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  menuTextBox: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  menuTitleLarge: {
    fontSize: 18.5,
  },
  menuTitleDanger: {
    fontSize: 16.5,
    fontWeight: '700',
    color: tokens.colors.alertCrimson,
  },
  menuSub: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  menuSubRed: {
    color: tokens.colors.alertCrimson,
    fontWeight: '600',
  },
  menuSubAmber: {
    color: tokens.colors.accentOchre,
    fontWeight: '600',
  },
  devCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  devCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
    marginBottom: 10,
  },
  devStack: {
    gap: 10,
  },
});
