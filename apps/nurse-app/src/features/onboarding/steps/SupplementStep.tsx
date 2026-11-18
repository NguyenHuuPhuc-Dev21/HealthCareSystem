import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Award } from 'lucide-react-native';
import { tokens } from '../../../styles/tokens';
import { DocumentCaptureCard } from '../components/DocumentCaptureCard';

interface SupplementStepProps {
  isRetired: boolean;
  onIsRetiredChange: (val: boolean) => void;
  retirementUri: string | null;
  onCaptureRetirement: () => void;
  onRemoveRetirement: () => void;
}

export const SupplementStep: React.FC<SupplementStepProps> = ({
  isRetired,
  onIsRetiredChange,
  retirementUri,
  onCaptureRetirement,
  onRemoveRetirement,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Bước 5 · Giấy tờ bổ trợ (Không bắt buộc)</Text>
      <Text style={styles.stepSubtitle}>
        Dành riêng cho cán bộ, nhân viên y tế đã nghỉ hưu có nguyện vọng nhận huy hiệu “Cán bộ y tế hưu trí” và ghi nhận uy tín chuyên môn trên hồ sơ.
      </Text>

      <View style={styles.switchCard}>
        <View style={styles.switchTextWrap}>
          <View style={styles.switchTitleRow}>
            <Award color={tokens.colors.brandJade} size={20} />
            <Text style={styles.switchTitle}>Tôi là cán bộ y tế đã nghỉ hưu</Text>
          </View>
          <Text style={styles.switchDescription}>
            Bật tùy chọn này nếu bạn đã có quyết định nghỉ hưu hoặc sổ hưu trí y tế.
          </Text>
        </View>
        <Switch
          value={isRetired}
          onValueChange={onIsRetiredChange}
          trackColor={{ false: tokens.colors.borderHairline, true: tokens.colors.brandJade }}
          thumbColor="#FFFFFF"
          accessibilityLabel="Công tắc cán bộ y tế đã nghỉ hưu"
        />
      </View>

      {isRetired ? (
        <View style={styles.retirementSection}>
          <DocumentCaptureCard
            title="Quyết định nghỉ hưu / Sổ hưu trí"
            description="Chụp rõ quyết định nghỉ hưu, cơ quan ban hành, ngày có hiệu lực và họ tên người thụ hưởng."
            required
            imageUri={retirementUri}
            onCapture={onCaptureRetirement}
            onRemove={onRemoveRetirement}
          />
        </View>
      ) : (
        <View style={styles.skipNoteBox}>
          <Text style={styles.skipNoteText}>
            Nếu bạn không phải cán bộ y tế đã nghỉ hưu, bạn có thể nhấn <Text style={styles.boldText}>Tiếp theo</Text> để chuyển sang bước xem lại hồ sơ.
          </Text>
        </View>
      )}
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
    marginBottom: 16,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.paper,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.paddingBase,
    marginBottom: 16,
    gap: 12,
  },
  switchTextWrap: {
    flex: 1,
  },
  switchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  switchDescription: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 18,
  },
  retirementSection: {
    marginTop: 4,
  },
  skipNoteBox: {
    padding: 14,
    backgroundColor: tokens.colors.canvas,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  skipNoteText: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
});
