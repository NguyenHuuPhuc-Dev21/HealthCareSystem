import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { DocumentCaptureCard } from '../components/DocumentCaptureCard';

interface IdCardStepProps {
  cccdNumber: string;
  onCccdNumberChange: (val: string) => void;
  frontUri: string | null;
  onCaptureFront: () => void;
  onRemoveFront: () => void;
  backUri: string | null;
  onCaptureBack: () => void;
  onRemoveBack: () => void;
}

export const IdCardStep: React.FC<IdCardStepProps> = ({
  cccdNumber,
  onCccdNumberChange,
  frontUri,
  onCaptureFront,
  onRemoveFront,
  backUri,
  onCaptureBack,
  onRemoveBack,
}) => {
  const isCccdValid = cccdNumber.length === 12;

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Bước 1 · Căn cước công dân (CCCD)</Text>
      <Text style={styles.stepSubtitle}>
        Chụp ảnh trực tiếp cả hai mặt thẻ CCCD gắn chip và nhập đúng 12 chữ số CCCD.
      </Text>

      <View style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>
          Số Căn cước công dân (12 chữ số) <Text style={styles.requiredStar}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, cccdNumber.length > 0 && !isCccdValid && styles.inputWarning]}
          value={cccdNumber}
          onChangeText={(text) => onCccdNumberChange(text.replace(/\D/g, '').slice(0, 12))}
          placeholder="Ví dụ: 079123456789"
          placeholderTextColor={tokens.colors.inkMuted}
          keyboardType="number-pad"
          maxLength={12}
          accessibilityLabel="Số Căn cước công dân"
        />
        {cccdNumber.length > 0 && !isCccdValid ? (
          <Text style={styles.fieldError}>Số CCCD phải đủ 12 chữ số (hiện có {cccdNumber.length}/12)</Text>
        ) : null}
      </View>

      <DocumentCaptureCard
        title="CCCD mặt trước"
        description="Chụp rõ họ tên, số thẻ, ngày sinh và ảnh chân dung trên thẻ."
        required
        imageUri={frontUri}
        onCapture={onCaptureFront}
        onRemove={onRemoveFront}
      />

      <DocumentCaptureCard
        title="CCCD mặt sau"
        description="Chụp rõ mã QR, dải MRZ và đặc điểm nhận dạng."
        required
        imageUri={backUri}
        onCapture={onCaptureBack}
        onRemove={onRemoveBack}
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
    marginBottom: 16,
  },
  fieldBox: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 6,
  },
  requiredStar: {
    color: tokens.colors.alertCrimson,
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
  inputWarning: {
    borderColor: tokens.colors.accentOchre,
  },
  fieldError: {
    color: tokens.colors.accentOchre,
    fontSize: 13,
    marginTop: 4,
  },
});
