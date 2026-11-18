import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { DocumentCaptureCard } from '../components/DocumentCaptureCard';

interface DegreeStepProps {
  degreeUri: string | null;
  onCaptureDegree: () => void;
  onRemoveDegree: () => void;
  yearsOfExp: string;
  onYearsOfExpChange: (val: string) => void;
}

export const DegreeStep: React.FC<DegreeStepProps> = ({
  degreeUri,
  onCaptureDegree,
  onRemoveDegree,
  yearsOfExp,
  onYearsOfExpChange,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Bước 3 · Bằng tốt nghiệp chuyên môn</Text>
      <Text style={styles.stepSubtitle}>
        Bằng tốt nghiệp trung cấp, cao đẳng hoặc đại học chuyên ngành Điều dưỡng / Y sĩ / Bác sĩ.
      </Text>

      <DocumentCaptureCard
        title="Bằng tốt nghiệp chuyên môn"
        description="Chụp toàn bộ văn bằng, rõ số hiệu bằng, trường cấp và xếp loại tốt nghiệp."
        required
        imageUri={degreeUri}
        onCapture={onCaptureDegree}
        onRemove={onRemoveDegree}
      />

      <View style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>Số năm kinh nghiệm làm việc thực tế</Text>
        <TextInput
          style={styles.input}
          value={yearsOfExp}
          onChangeText={(text) => onYearsOfExpChange(text.replace(/\D/g, '').slice(0, 2))}
          placeholder="Ví dụ: 5"
          placeholderTextColor={tokens.colors.inkMuted}
          keyboardType="number-pad"
          maxLength={2}
          accessibilityLabel="Số năm kinh nghiệm"
        />
        <Text style={styles.fieldHint}>Nhập số năm kinh nghiệm điều dưỡng hoặc chăm sóc y tế tại bệnh viện/phòng khám.</Text>
      </View>
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
  fieldBox: {
    marginTop: 4,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  input: {
    minHeight: tokens.spacing.touchTargetMin,
    backgroundColor: tokens.colors.paper,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: 14,
    fontSize: tokens.typography.fontSizeBase,
    color: tokens.colors.inkPrimary,
  },
  fieldHint: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
});
