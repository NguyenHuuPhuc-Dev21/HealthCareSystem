import React from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertOctagon,
  CreditCard,
  Headphones,
  HelpCircle,
  LogOut,
  PhoneCall,
  ShieldX,
} from 'lucide-react-native';
import { ProfileStatus } from '@healthcare-system/shared';
import { AppButton, CareNestLogoMark, StatusBadge } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { env } from '../../lib/env';
import { tokens } from '../../styles/tokens';

export const AccountLockedScreen: React.FC = () => {
  const { session, logout } = useAuth();
  const profile = session?.profile;
  const isBanned = profile?.profile_status === ProfileStatus.BANNED;
  const suspendedReason =
    profile?.suspended_reason ||
    'Tài khoản đang bị tạm ngưng nhận ca để kiểm tra hoặc chưa hoàn tất nghĩa vụ trên hệ thống.';

  const isDepositOrCommissionRelated =
    suspendedReason.toLowerCase().includes('ký quỹ') ||
    suspendedReason.toLowerCase().includes('hoa hồng') ||
    suspendedReason.toLowerCase().includes('deposit') ||
    suspendedReason.toLowerCase().includes('commission');

  const handleCallHotline = () => {
    const rawNumber = env.supportHotline.replace(/\s/g, '');
    void Linking.openURL(`tel:${rawNumber}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBrandWrap}>
          <CareNestLogoMark size={36} />
        </View>

        <View style={styles.topIconBox}>
          {isBanned ? (
            <ShieldX color={tokens.colors.alertCrimson} size={48} />
          ) : (
            <AlertOctagon color={tokens.colors.alertCrimson} size={48} />
          )}
        </View>

        <View style={styles.badgeRow}>
          <StatusBadge
            label={isBanned ? 'Tài khoản bị cấm (BANNED)' : 'Tài khoản bị tạm khóa (SUSPENDED)'}
            tone="crimson"
          />
        </View>

        <Text style={styles.title}>
          {isBanned ? 'Hợp tác bị chấm dứt' : 'Không thể nhận ca mới'}
        </Text>

        {/* Reason Card */}
        <View style={styles.reasonCard}>
          <Text style={styles.reasonLabel}>Lý do khóa từ CareNest:</Text>
          <Text style={styles.reasonText}>{suspendedReason}</Text>
        </View>

        {/* Hướng dẫn khi liên quan đến Ký quỹ (A10) hoặc Hoa hồng (A11) */}
        {isDepositOrCommissionRelated ? (
          <View style={styles.guidanceCard}>
            <View style={styles.guidanceHeader}>
              <CreditCard color={tokens.colors.accentOchre} size={20} />
              <Text style={styles.guidanceTitle}>Nghĩa vụ tài chính cần hoàn tất</Text>
            </View>
            <Text style={styles.guidanceBody}>
              Tài khoản của bạn tạm thời bị khóa do chưa duy trì đủ số dư ký quỹ tối thiểu (300.000 VNĐ) hoặc chưa thanh toán phí hoa hồng ca tiền mặt trong vòng 24 giờ sau khi kết thúc ca.
            </Text>
            <Text style={styles.guidanceSub}>
              Tính năng Nạp ký quỹ và Nộp hoa hồng trực tuyến qua VietQR (A10 / A11) sẽ có mặt trong phiên bản cập nhật tiếp theo. Hiện tại, vui lòng liên hệ bộ phận vận hành để được hướng dẫn chuyển khoản đối soát mở khóa.
            </Text>
          </View>
        ) : (
          <View style={styles.guidanceCard}>
            <View style={styles.guidanceHeader}>
              <HelpCircle color={tokens.colors.brandJade} size={20} />
              <Text style={styles.guidanceTitle}>Hướng dẫn giải quyết khiếu nại</Text>
            </View>
            <Text style={styles.guidanceBody}>
              Nếu bạn cho rằng quyết định này là nhầm lẫn hoặc muốn nộp giải trình vi phạm, vui lòng liên hệ với Bộ phận Hỗ trợ Đối tác Điều dưỡng CareNest qua hotline hoặc email.
            </Text>
          </View>
        )}

        {/* Hotline Contact Card */}
        <View style={styles.contactCard}>
          <View style={styles.contactLeft}>
            <Headphones color={tokens.colors.brandJade} size={24} />
            <View>
              <Text style={styles.contactLabel}>Hotline Chăm sóc Điều dưỡng:</Text>
              <Text style={styles.contactNumber}>{env.supportHotline}</Text>
              <Text style={styles.contactHours}>Giờ làm việc: 08:00 – 20:00 hàng ngày</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleCallHotline}
            activeOpacity={0.8}
            style={styles.callBtn}
            accessibilityRole="button"
            accessibilityLabel={`Gọi hotline ${env.supportHotline}`}
          >
            <PhoneCall color="#FFFFFF" size={18} />
            <Text style={styles.callBtnText}>Gọi ngay</Text>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.actionsBox}>
          <AppButton
            label="Đăng xuất tài khoản"
            variant="secondary"
            onPress={() => void logout()}
            style={styles.logoutBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  content: {
    padding: tokens.spacing.paddingBase,
    paddingBottom: 40,
    alignItems: 'center',
  },
  topBrandWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  topIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  badgeRow: {
    marginBottom: 10,
  },
  title: {
    fontSize: tokens.typography.fontSizeTitle,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  reasonCard: {
    width: '100%',
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderWidth: 1.5,
    borderColor: tokens.colors.alertCrimson,
    borderRadius: tokens.radii.md,
    padding: 16,
    marginBottom: 16,
    gap: 6,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.alertCrimson,
  },
  reasonText: {
    fontSize: 15,
    color: tokens.colors.inkPrimary,
    lineHeight: 22,
    fontWeight: '500',
  },
  guidanceCard: {
    width: '100%',
    backgroundColor: tokens.colors.paper,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.md,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  guidanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guidanceTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  guidanceBody: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
  },
  guidanceSub: {
    fontSize: 13,
    color: tokens.colors.inkMuted,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  contactCard: {
    width: '100%',
    backgroundColor: tokens.colors.paper,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    borderRadius: tokens.radii.md,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  contactLabel: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
  },
  contactNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.brandJade,
    marginVertical: 2,
  },
  contactHours: {
    fontSize: 12,
    color: tokens.colors.inkMuted,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.brandJade,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: tokens.radii.sm,
    minHeight: tokens.spacing.touchTargetMin,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  actionsBox: {
    width: '100%',
    gap: 12,
  },
  logoutBtn: {
    width: '100%',
    minHeight: tokens.spacing.touchTargetMin,
  },
});
