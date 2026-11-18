import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react-native';
import { AppButton } from '../../../components';
import { tokens } from '../../../styles/tokens';

export interface DocumentCaptureCardProps {
  title: string;
  description?: string;
  required?: boolean;
  imageUri: string | null;
  onCapture: () => void;
  onRetake?: () => void;
  onRemove?: () => void;
  status?: 'idle' | 'captured' | 'uploading' | 'error';
  errorMessage?: string;
  uploadProgress?: number;
  testID?: string;
}

export const DocumentCaptureCard: React.FC<DocumentCaptureCardProps> = ({
  title,
  description,
  required = false,
  imageUri,
  onCapture,
  onRetake,
  onRemove,
  status = imageUri ? 'captured' : 'idle',
  errorMessage,
  uploadProgress,
  testID,
}) => {
  const isCaptured = Boolean(imageUri);
  const isUploading = status === 'uploading';

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {required ? <Text style={styles.requiredMark}>*</Text> : null}
        </View>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>

      {isUploading ? (
        <View style={styles.uploadingBox}>
          <ActivityIndicator color={tokens.colors.brandJade} size="small" />
          <Text style={styles.uploadingText}>
            Đang tải lên... {uploadProgress !== undefined ? `${Math.round(uploadProgress)}%` : ''}
          </Text>
        </View>
      ) : isCaptured && imageUri ? (
        <View style={styles.previewContainer}>
          <View style={styles.imageWrap}>
            <Image
              source={{ uri: imageUri }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
            <View style={styles.capturedBadge}>
              <CheckCircle2 color="#FFFFFF" size={14} />
              <Text style={styles.capturedText}>Đã chụp</Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={onRetake ?? onCapture}
              activeOpacity={0.8}
              style={styles.retakeBtn}
              accessibilityRole="button"
              accessibilityLabel={`Chụp lại ${title}`}
            >
              <RotateCcw color={tokens.colors.brandJade} size={18} />
              <Text style={styles.retakeBtnText}>Chụp lại</Text>
            </TouchableOpacity>

            {onRemove ? (
              <TouchableOpacity
                onPress={onRemove}
                activeOpacity={0.8}
                style={styles.removeBtn}
                accessibilityRole="button"
                accessibilityLabel={`Xóa ảnh ${title}`}
              >
                <Trash2 color={tokens.colors.alertCrimson} size={18} />
                <Text style={styles.removeBtnText}>Xóa</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.cameraIconBox}>
            <Camera color={tokens.colors.brandJade} size={28} />
          </View>
          <Text style={styles.hintText}>Chụp trực tiếp bằng camera, không chọn từ thư viện ảnh</Text>
          <AppButton
            label="Chụp ảnh ngay"
            onPress={onCapture}
            variant="secondary"
            style={styles.captureBtn}
          />
        </View>
      )}

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    padding: tokens.spacing.paddingBase,
    marginBottom: 16,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: tokens.typography.fontSizeBase,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  requiredMark: {
    color: tokens.colors.alertCrimson,
    fontSize: tokens.typography.fontSizeBase,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    marginTop: 3,
    lineHeight: 19,
  },
  emptyContainer: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.canvas,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: tokens.colors.brandJadeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    textAlign: 'center',
  },
  captureBtn: {
    marginTop: 4,
    minWidth: 180,
  },
  previewContainer: {
    gap: 12,
  },
  imageWrap: {
    width: '100%',
    height: 160,
    borderRadius: tokens.radii.sm,
    overflow: 'hidden',
    backgroundColor: '#0F1A17',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  capturedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.brandJade,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  capturedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: tokens.radii.sm,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
    backgroundColor: tokens.colors.brandJadeSoft,
    minHeight: tokens.spacing.touchTargetMin,
  },
  retakeBtnText: {
    color: tokens.colors.brandJade,
    fontSize: 15,
    fontWeight: '700',
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: tokens.spacing.touchTargetMin,
  },
  removeBtnText: {
    color: tokens.colors.alertCrimson,
    fontSize: 15,
    fontWeight: '600',
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
    backgroundColor: tokens.colors.canvas,
    borderRadius: tokens.radii.sm,
  },
  uploadingText: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    fontWeight: '600',
  },
  errorBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderRadius: tokens.radii.sm,
  },
  errorText: {
    color: tokens.colors.alertCrimson,
    fontSize: 13.5,
    lineHeight: 18,
  },
});
