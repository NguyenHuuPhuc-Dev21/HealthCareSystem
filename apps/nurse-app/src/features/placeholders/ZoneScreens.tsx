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
import { tokens } from '../../styles/tokens';
import type { ActiveStackParamList } from '../../navigation/types';

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

export const SchedulePlaceholderScreen: React.FC = () => (
  <RoadmapTabTemplate
    badge="Giai đoạn M2"
    title="Lịch rảnh & Ngày nghỉ"
    description="Cấu hình khung giờ rảnh hằng tuần, ngày nghỉ và phủ lớp ca đã xác nhận."
  />
);

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
              label="Về danh sách ca trực"
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

