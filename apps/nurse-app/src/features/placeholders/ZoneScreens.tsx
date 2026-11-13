import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_RECORD_ACCESS_EXPIRY_HOURS,
  DEFAULT_SETTLEMENT_COOLING_HOURS,
  DEFAULT_TRAVEL_SUPPORT_VND,
} from '@healthcare-system/shared';
import { AppButton, StatusBadge } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { env } from '../../lib/env';
import { IS_DEV } from '../../lib/hardware-providers';
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList } from '../../navigation/types';

export const LoginPlaceholderScreen: React.FC = () => {
  const { enterDevZone } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brandMark}>CareNest</Text>
        <Text style={styles.title}>Đăng nhập điều dưỡng</Text>
        <Text style={styles.subtitle}>
          Luồng đăng nhập SĐT + OTP và Onboarding eKYC sẽ được triển khai ở Giai đoạn M1.
        </Text>

        <View style={styles.card}>
          <StatusBadge label="Vùng 1 · Chưa đăng nhập" tone="neutral" />
          <Text style={styles.cardBody}>
            API đang cấu hình: {env.apiBaseUrl}
          </Text>
          {IS_DEV ? (
            <View style={styles.stack}>
              <AppButton
                label="[DEV] Vào thẳng ca mẫu (ACTIVE)"
                onPress={() => void enterDevZone('active')}
              />
              <AppButton
                label="[DEV] Kiểm thử vùng Onboarding"
                variant="secondary"
                onPress={() => void enterDevZone('onboarding')}
              />
              <AppButton
                label="[DEV] Kiểm thử vùng Chờ duyệt"
                variant="secondary"
                onPress={() => void enterDevZone('pending')}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export const OnboardingPlaceholderScreen: React.FC = () => {
  const { logout, enterDevZone } = useAuth();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <StatusBadge label="Vùng 2 · Đang thiết lập hồ sơ" tone="ochre" />
        <Text style={[styles.title, { marginTop: 12 }]}>Hồ sơ eKYC 5 bước</Text>
        <Text style={styles.subtitle}>
          Chụp CCCD 2 mặt, selfie chân dung, bằng cấp và GPHN sẽ có ở Giai đoạn M1.
        </Text>
        {IS_DEV ? (
          <View style={styles.stack}>
            <AppButton
              label="[DEV] Chuyển sang trạng thái Đã duyệt"
              onPress={() => void enterDevZone('active')}
            />
            <AppButton
              label="Đăng xuất"
              variant="secondary"
              onPress={() => void logout()}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

export const PendingApprovalScreen: React.FC = () => {
  const { logout, enterDevZone } = useAuth();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <StatusBadge label="Vùng 2 · Chờ duyệt hồ sơ" tone="ochre" />
        <Text style={[styles.title, { marginTop: 12 }]}>Hồ sơ đang chờ kiểm duyệt</Text>
        <Text style={styles.subtitle}>
          Quản trị viên sẽ kiểm tra CCCD, bằng chuyên môn và GPHN trước khi kích hoạt nhận ca.
        </Text>
        <View style={styles.stack}>
          {IS_DEV ? (
            <AppButton
              label="[DEV] Giả lập đã duyệt (ACTIVE)"
              onPress={() => void enterDevZone('active')}
            />
          ) : null}
          <AppButton label="Đăng xuất" variant="secondary" onPress={() => void logout()} />
        </View>
      </View>
    </SafeAreaView>
  );
};

export const AccountLockedScreen: React.FC = () => {
  const { session, logout } = useAuth();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <StatusBadge label="Tài khoản đang bị khóa" tone="crimson" />
        <Text style={[styles.title, { marginTop: 12 }]}>Không thể nhận ca mới</Text>
        <Text style={styles.subtitle}>
          {session?.profile?.suspended_reason ||
            'Tài khoản của bạn đang bị tạm khóa. Vui lòng liên hệ bộ phận hỗ trợ CareNest.'}
        </Text>
        <View style={styles.stack}>
          <AppButton label="Đăng xuất" variant="secondary" onPress={() => void logout()} />
        </View>
      </View>
    </SafeAreaView>
  );
};

function RoadmapTabTemplate({
  badge,
  title,
  description,
}: {
  badge: string;
  title: string;
  description: string;
}) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <StatusBadge label={badge} tone="jade" />
        <Text style={[styles.title, { marginTop: 12 }]}>{title}</Text>
        <Text style={styles.subtitle}>{description}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export const JobsPlaceholderScreen: React.FC = () => (
  <RoadmapTabTemplate
    badge="Giai đoạn M3"
    title="Bảng việc làm & Radar"
    description="Danh sách ca đặt trước > 6 giờ, lời mời trực tiếp và Radar ca khẩn cấp sẽ hiển thị tại đây."
  />
);

export const ShiftsPlaceholderScreen: React.FC = () => (
  <RoadmapTabTemplate
    badge="Giai đoạn M4"
    title="Ca trực của tôi"
    description="Theo dõi các ca đã nhận và lịch sử thực hiện ca lâm sàng."
  />
);

export const SchedulePlaceholderScreen: React.FC = () => (
  <RoadmapTabTemplate
    badge="Giai đoạn M2"
    title="Lịch rảnh & Ngày nghỉ"
    description="Cấu hình khung giờ rảnh hằng tuần, ngày nghỉ và phủ lớp ca đã xác nhận."
  />
);

export const ProfilePlaceholderScreen: React.FC = () => {
  const { session, logout, enterDevZone } = useAuth();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <StatusBadge label="Vùng 3 · Đã duyệt (ACTIVE)" tone="jade" />
        <Text style={[styles.title, { marginTop: 12 }]}>
          {session?.user.full_name || 'Điều dưỡng CareNest'}
        </Text>
        <Text style={styles.subtitle}>
          SĐT: {session?.user.phone || 'Chưa cập nhật'} · TrustScore:{' '}
          {session?.profile?.trust_score ?? 100}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kiểm thử chuyển vùng điều hướng</Text>
          <Text style={styles.cardBody}>Endpoint: {env.apiBaseUrl}</Text>
          <View style={styles.stack}>
            {IS_DEV ? (
              <>
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
              </>
            ) : null}
            <AppButton label="Đăng xuất" variant="danger" onPress={() => void logout()} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

type ShiftResultProps = NativeStackScreenProps<ActiveStackParamList, 'ShiftResult'>;

export const ShiftResultScreen: React.FC<ShiftResultProps> = ({ navigation, route }) => {
  const { outcomeType, note } = route.params;
  const isCancelledSafe = outcomeType === 'CANCELLED_SAFE';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.resultCard}>
          <Text style={styles.title}>
            {isCancelledSafe ? 'Ca trực đã dừng an toàn' : 'Ca làm việc đã hoàn tất'}
          </Text>
          <Text style={styles.subtitle}>
            {isCancelledSafe
              ? `Hệ thống đã ghi nhận lý do dừng ca (${note || 'Bảo vệ an toàn lâm sàng'}). Bạn không bị phạt tiền, không trừ điểm tin cậy và được hỗ trợ ${DEFAULT_TRAVEL_SUPPORT_VND.toLocaleString('vi-VN')}đ chi phí di chuyển nếu do sai lệch y lệnh.`
              : `Báo cáo ca tối thiểu đã được gửi cho người nhà. Thù lao sẽ tự động quyết toán sau ${DEFAULT_SETTLEMENT_COOLING_HOURS} giờ và quyền xem hồ sơ bệnh án sẽ tự động khóa sau ${DEFAULT_RECORD_ACCESS_EXPIRY_HOURS} giờ để bảo vệ dữ liệu riêng tư.`}
          </Text>
          <View style={styles.stack}>
            <AppButton
              label="Về màn hình chính"
              onPress={() => navigation.popToTop()}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  content: {
    padding: 18,
  },
  brandMark: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.brandJade,
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: tokens.colors.inkSecondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  resultCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    marginTop: 20,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    marginTop: 10,
    marginBottom: 14,
  },
  stack: {
    gap: 12,
    marginTop: 12,
  },
});

