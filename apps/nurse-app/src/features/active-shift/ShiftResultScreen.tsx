import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2, Star } from 'lucide-react-native';
import {
  DEFAULT_RECORD_ACCESS_EXPIRY_HOURS,
  DEFAULT_SETTLEMENT_COOLING_HOURS,
  DEFAULT_TRAVEL_SUPPORT_VND,
} from '@healthcare-system/shared';
import { AppButton } from '../../components/AppButton';
import type { ActiveStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import { RateCustomerSheet } from '../reviews/components/RateCustomerSheet';
import { getPendingReviews } from '../reviews/reviews.api';

type ShiftResultProps = NativeStackScreenProps<ActiveStackParamList, 'ShiftResult'>;

interface ReviewTarget {
  bookingId: string;
  bookingCode: string;
  customerName: string;
}

export const ShiftResultScreen: React.FC<ShiftResultProps> = ({
  navigation,
  route,
}) => {
  const { outcomeType, note, bookingId, bookingCode, customerName } = route.params;
  const isCancelledSafe = outcomeType === 'CANCELLED_SAFE';

  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(
    bookingId
      ? {
          bookingId,
          bookingCode: bookingCode || `BK-${bookingId}`,
          customerName: customerName || 'Khách hàng CareNest',
        }
      : null
  );
  const [rateSheetVisible, setRateSheetVisible] = useState<boolean>(false);
  const [hasRated, setHasRated] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isCancelledSafe || hasRated) return;

    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        if (reviewTarget) {
          if (active) setRateSheetVisible(true);
          return;
        }
        try {
          const res = await getPendingReviews();
          if (active && res.success && res.data.length > 0) {
            const first = res.data[0];
            setReviewTarget({
              bookingId: first.bookingId,
              bookingCode: first.bookingCode,
              customerName: first.customerName,
            });
            setRateSheetVisible(true);
          }
        } catch {
          // ignore
        }
      })();
    }, 1000);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isCancelledSafe, hasRated, reviewTarget]);

  const handleReviewSuccess = (message: string) => {
    setRateSheetVisible(false);
    setHasRated(true);
    setToastMessage(message);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {toastMessage ? (
          <View style={styles.toastBox} accessibilityRole="alert">
            <CheckCircle2 size={20} color={tokens.colors.brandJade} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        ) : null}

        <View style={styles.resultCard}>
          <Text style={styles.title}>
            {isCancelledSafe
              ? 'Ca trực đã dừng an toàn'
              : 'Ca làm việc đã hoàn tất'}
          </Text>
          <Text style={styles.subtitle}>
            {isCancelledSafe
              ? `Hệ thống đã ghi nhận lý do dừng ca (${note || 'Bảo vệ an toàn lâm sàng'}). Bạn không bị phạt tiền, không trừ điểm tin cậy và được hỗ trợ ${DEFAULT_TRAVEL_SUPPORT_VND.toLocaleString('vi-VN')}đ chi phí di chuyển nếu do sai lệch y lệnh.`
              : `Báo cáo ca tối thiểu đã được gửi cho người nhà. Thù lao sẽ tự động quyết toán sau ${DEFAULT_SETTLEMENT_COOLING_HOURS} giờ và quyền xem hồ sơ bệnh án sẽ tự động khóa sau ${DEFAULT_RECORD_ACCESS_EXPIRY_HOURS} giờ để bảo vệ dữ liệu riêng tư.`}
          </Text>
          <View style={styles.stack}>
            {!isCancelledSafe && reviewTarget && !hasRated ? (
              <AppButton
                label="Đánh giá khách"
                variant="secondary"
                icon={<Star size={18} color={tokens.colors.brandJade} />}
                onPress={() => setRateSheetVisible(true)}
              />
            ) : null}
            <AppButton
              label="Về danh sách ca trực"
              onPress={() => navigation.popToTop()}
            />
          </View>
        </View>
      </View>

      {reviewTarget ? (
        <RateCustomerSheet
          visible={rateSheetVisible}
          bookingId={reviewTarget.bookingId}
          bookingCode={reviewTarget.bookingCode}
          customerName={reviewTarget.customerName}
          onClose={() => setRateSheetVisible(false)}
          onSuccess={handleReviewSuccess}
        />
      ) : null}
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
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tokens.colors.brandJadeSoft,
    borderWidth: 1,
    borderColor: tokens.colors.brandJade,
    borderRadius: tokens.radii.md,
    padding: 14,
    marginBottom: 12,
  },
  toastText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
    lineHeight: 20,
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
  resultCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    marginTop: 12,
  },
  stack: {
    gap: 12,
    marginTop: 12,
  },
});
