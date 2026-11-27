import React from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertTriangle, Award, CheckCircle2 } from 'lucide-react-native';
import { tokens } from '../../../styles/tokens';
import { DocumentCaptureCard } from '../components/DocumentCaptureCard';

interface GphnStepProps {
  hasGphn: boolean;
  onHasGphnToggle: (val: boolean) => void;
  gphnUri: string | null;
  onCaptureGphn: () => void;
  onRemoveGphn: () => void;
  gphnNumber: string;
  onGphnNumberChange: (val: string) => void;
  gphnIssuedDate: string;
  onGphnIssuedDateChange: (val: string) => void;
  gphnExpiryDate: string;
  onGphnExpiryDateChange: (val: string) => void;
  gphnAuthority: string;
  onGphnAuthorityChange: (val: string) => void;
  scopeOfPractice: string;
  onScopeOfPracticeChange: (val: string) => void;
}

export const GphnStep: React.FC<GphnStepProps> = ({
  hasGphn,
  onHasGphnToggle,
  gphnUri,
  onCaptureGphn,
  onRemoveGphn,
  gphnNumber,
  onGphnNumberChange,
  gphnIssuedDate,
  onGphnIssuedDateChange,
  gphnExpiryDate,
  onGphnExpiryDateChange,
  gphnAuthority,
  onGphnAuthorityChange,
  scopeOfPractice,
  onScopeOfPracticeChange,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const isExpired = Boolean(gphnExpiryDate && gphnExpiryDate <= today);
  const isInvalidOrder = Boolean(
    gphnIssuedDate && gphnExpiryDate && gphnExpiryDate <= gphnIssuedDate
  );

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Bước 4 · Giấy phép hành nghề (GPHN)</Text>
      <Text style={styles.stepSubtitle}>
        Có GPHN còn thời hạn sẽ được xét duyệt vào <Text style={styles.boldText}>Tầng 2 (Chuyên môn cao, nhận thủ thuật xâm lấn)</Text>.
      </Text>

      {/* Choice Card: Có GPHN hay Chưa có GPHN */}
      <View style={styles.choiceCard}>
        <TouchableOpacity
          style={[styles.choiceOption, hasGphn && styles.choiceOptionSelected]}
          onPress={() => onHasGphnToggle(true)}
          activeOpacity={0.8}
          accessibilityRole="radio"
          accessibilityState={{ checked: hasGphn }}
          accessibilityLabel="Tôi có Giấy phép hành nghề"
        >
          <View style={styles.radioRow}>
            <View style={[styles.radioCircle, hasGphn && styles.radioCircleActive]}>
              {hasGphn ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={styles.radioTextWrap}>
              <Text style={styles.choiceTitle}>Tôi có GPHN hợp lệ</Text>
              <Text style={styles.choiceSubtitle}>Xét duyệt Tầng 2 (Thủ thuật xâm lấn theo y lệnh)</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.choiceOption, !hasGphn && styles.choiceOptionSelected]}
          onPress={() => onHasGphnToggle(false)}
          activeOpacity={0.8}
          accessibilityRole="radio"
          accessibilityState={{ checked: !hasGphn }}
          accessibilityLabel="Tôi chưa có Giấy phép hành nghề"
        >
          <View style={styles.radioRow}>
            <View style={[styles.radioCircle, !hasGphn && styles.radioCircleActive]}>
              {!hasGphn ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={styles.radioTextWrap}>
              <Text style={styles.choiceTitle}>Tôi chưa có GPHN</Text>
              <Text style={styles.choiceSubtitle}>Xét duyệt Tầng 1 (Chăm sóc cơ bản, hỗ trợ sinh hoạt)</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {!hasGphn ? (
        <View style={styles.tier1NoticeBox}>
          <Award color={tokens.colors.brandJade} size={24} />
          <View style={styles.tier1NoticeContent}>
            <Text style={styles.tier1NoticeTitle}>Tham gia CareNest với Tầng 1</Text>
            <Text style={styles.tier1NoticeDesc}>
              Bạn có thể bỏ qua bước này để được duyệt vào Tầng 1 ngay. Khi đã có hoặc gia hạn xong GPHN, bạn có thể tải lên bổ sung trong mục Hồ sơ để nâng cấp Tầng 2.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.formSection}>
          <DocumentCaptureCard
            title="Ảnh chụp Giấy phép hành nghề"
            description="Chụp rõ toàn bộ mặt trước GPHN, số giấy phép, phạm vi hoạt động chuyên môn và ngày hết hạn."
            required
            imageUri={gphnUri}
            onCapture={onCaptureGphn}
            onRemove={onRemoveGphn}
          />

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>
              Số GPHN <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={gphnNumber}
              onChangeText={onGphnNumberChange}
              placeholder="Ví dụ: 01284/GPHN-ĐN"
              placeholderTextColor={tokens.colors.inkMuted}
              autoCapitalize="characters"
              accessibilityLabel="Số GPHN"
            />
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>
              Cơ quan cấp GPHN <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={gphnAuthority}
              onChangeText={onGphnAuthorityChange}
              placeholder="Ví dụ: Sở Y tế TP. Đà Nẵng"
              placeholderTextColor={tokens.colors.inkMuted}
              accessibilityLabel="Cơ quan cấp GPHN"
            />
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>
              Phạm vi hoạt động chuyên môn <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={scopeOfPractice}
              onChangeText={onScopeOfPracticeChange}
              placeholder="Ví dụ: Điều dưỡng đa khoa"
              placeholderTextColor={tokens.colors.inkMuted}
              accessibilityLabel="Phạm vi hoạt động chuyên môn"
            />
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>
              Ngày cấp (YYYY-MM-DD) <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={gphnIssuedDate}
              onChangeText={onGphnIssuedDateChange}
              placeholder="2020-05-15"
              placeholderTextColor={tokens.colors.inkMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              accessibilityLabel="Ngày cấp GPHN"
            />
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>
              Ngày hết hạn của GPHN (YYYY-MM-DD) <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, isExpired && styles.inputError]}
              value={gphnExpiryDate}
              onChangeText={onGphnExpiryDateChange}
              placeholder="2027-05-15"
              placeholderTextColor={tokens.colors.inkMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              accessibilityLabel="Ngày hết hạn GPHN"
            />
            {isExpired ? (
              <View style={styles.errorAlert}>
                <AlertTriangle color={tokens.colors.alertCrimson} size={18} />
                <Text style={styles.errorAlertText}>
                  GPHN đã hết hạn — ngày hết hạn phải sau hôm nay ({today}). Vui lòng kiểm tra lại hoặc chuyển sang tùy chọn "Tôi chưa có GPHN" để vào Tầng 1.
                </Text>
              </View>
            ) : isInvalidOrder ? (
              <View style={styles.errorAlert}>
                <AlertTriangle color={tokens.colors.alertCrimson} size={18} />
                <Text style={styles.errorAlertText}>Ngày hết hạn phải sau ngày cấp GPHN.</Text>
              </View>
            ) : (
              <Text style={styles.fieldHint}>Ngày hết hạn bắt buộc phải còn hiệu lực sau ngày hôm nay.</Text>
            )}
          </View>
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
  boldText: {
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  choiceCard: {
    gap: 10,
    marginBottom: 18,
  },
  choiceOption: {
    padding: 14,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.paper,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    minHeight: tokens.spacing.touchTargetMin,
  },
  choiceOptionSelected: {
    borderColor: tokens.colors.brandJade,
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: tokens.colors.borderHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: tokens.colors.brandJade,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.colors.brandJade,
  },
  radioTextWrap: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  choiceSubtitle: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  tier1NoticeBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: tokens.colors.brandJadeSoft,
    borderWidth: 1,
    borderColor: tokens.colors.brandJade,
    borderRadius: tokens.radii.sm,
    padding: 14,
    alignItems: 'flex-start',
  },
  tier1NoticeContent: {
    flex: 1,
  },
  tier1NoticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
    marginBottom: 4,
  },
  tier1NoticeDesc: {
    fontSize: 13.5,
    color: tokens.colors.inkPrimary,
    lineHeight: 19,
  },
  formSection: {
    marginTop: 4,
  },
  fieldBox: {
    marginBottom: 14,
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
  inputError: {
    borderColor: tokens.colors.alertCrimson,
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  fieldHint: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    marginTop: 4,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
    padding: 10,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  errorAlertText: {
    flex: 1,
    color: tokens.colors.alertCrimson,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
