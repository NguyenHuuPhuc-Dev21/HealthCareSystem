import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { tokens } from '../../../styles/tokens';
import { DocumentCaptureCard } from '../components/DocumentCaptureCard';

interface PortraitStepProps {
  portraitUri: string | null;
  onCapturePortrait: () => void;
  onRemovePortrait: () => void;
}

export const PortraitStep: React.FC<PortraitStepProps> = ({
  portraitUri,
  onCapturePortrait,
  onRemovePortrait,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Bước 2 · Ảnh chân dung trực tiếp</Text>
      <Text style={styles.stepSubtitle}>
        Chụp ảnh chân dung selfie ngay tại thời điểm này bằng camera trước để hệ thống và Quản trị viên đối chiếu với ảnh trên CCCD.
      </Text>

      <View style={styles.securityBanner}>
        <ShieldCheck color={tokens.colors.brandJade} size={22} style={styles.shieldIcon} />
        <Text style={styles.securityText}>
          Theo quy chuẩn xác thực eKYC an toàn (FR-AUTH-01), ảnh chân dung bắt buộc chụp trực tiếp từ camera. Ứng dụng không hỗ trợ chọn ảnh từ thư viện thiết bị.
        </Text>
      </View>

      <DocumentCaptureCard
        title="Ảnh chân dung selfie trực tiếp"
        description="Đứng ở nơi đủ sáng, không đeo khẩu trang hay kính râm, hướng mắt nhìn thẳng vào camera."
        required
        imageUri={portraitUri}
        onCapture={onCapturePortrait}
        onRemove={onRemovePortrait}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  stepTitle: {
    fontSize: tokens.typography.fontSizeLarge,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 21,
    marginBottom: 14,
  },
  securityBanner: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.brandJadeSoft,
    borderWidth: 1,
    borderColor: tokens.colors.brandJade,
    borderRadius: tokens.radii.sm,
    padding: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  shieldIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  securityText: {
    flex: 1,
    fontSize: 13.5,
    color: tokens.colors.brandJadeDark,
    lineHeight: 19,
  },
});
