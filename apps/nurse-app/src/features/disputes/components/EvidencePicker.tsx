import React from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  FolderOpen,
  Plus,
  Video as VideoIcon,
  X,
} from 'lucide-react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
} from 'react-native-image-picker';
import {
  DISPUTE_MAX_EVIDENCE_FILES,
  DISPUTE_MAX_FILE_SIZE_BYTES,
  DISPUTE_MAX_VIDEO_DURATION_SECONDS,
} from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';

export interface SelectedEvidenceItem {
  id: string;
  uri: string;
  fileName: string;
  contentType: string;
  kind: 'IMAGE' | 'VIDEO';
  fileSizeBytes?: number;
  durationSeconds?: number;
}

export interface EvidencePickerProps {
  files: SelectedEvidenceItem[];
  onChange: (next: SelectedEvidenceItem[]) => void;
  disabled?: boolean;
}

export function validateEvidenceAsset(
  asset: {
    uri?: string;
    fileSize?: number;
    duration?: number;
    type?: string;
    fileName?: string;
  },
  currentCount: number
): { valid: true } | { valid: false; reason: string } {
  if (currentCount >= DISPUTE_MAX_EVIDENCE_FILES) {
    return {
      valid: false,
      reason: `Chỉ được đính kèm tối đa ${DISPUTE_MAX_EVIDENCE_FILES} tệp bằng chứng.`,
    };
  }
  if (!asset.uri) {
    return { valid: false, reason: 'Không đọc được đường dẫn tệp đã chọn.' };
  }
  if (asset.fileSize && asset.fileSize > DISPUTE_MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      reason: 'Dung lượng mỗi tệp không được vượt quá 20 MB.',
    };
  }
  const isVideo = Boolean(asset.type?.startsWith('video/'));
  if (
    isVideo &&
    asset.duration &&
    asset.duration > DISPUTE_MAX_VIDEO_DURATION_SECONDS
  ) {
    return {
      valid: false,
      reason: `Thời lượng video không được vượt quá ${DISPUTE_MAX_VIDEO_DURATION_SECONDS} giây.`,
    };
  }
  return { valid: true };
}

function mapAssetToEvidence(asset: Asset, idx: number): SelectedEvidenceItem {
  const isVideo = Boolean(asset.type?.startsWith('video/'));
  const ext = isVideo ? 'mp4' : 'jpg';
  return {
    id: `ev-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    uri: asset.uri!,
    fileName: asset.fileName || `bang_chung_${Date.now()}_${idx}.${ext}`,
    contentType: asset.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
    kind: isVideo ? 'VIDEO' : 'IMAGE',
    fileSizeBytes: asset.fileSize,
    durationSeconds: asset.duration,
  };
}

export const EvidencePicker: React.FC<EvidencePickerProps> = ({
  files,
  onChange,
  disabled = false,
}) => {
  const remaining = DISPUTE_MAX_EVIDENCE_FILES - files.length;

  const appendAssets = (assets?: Asset[]) => {
    if (!assets || assets.length === 0) return;
    const next = [...files];
    for (let i = 0; i < assets.length; i += 1) {
      const asset = assets[i];
      const check = validateEvidenceAsset(asset, next.length);
      if (!check.valid) {
        Alert.alert('Không thể thêm tệp', check.reason);
        break;
      }
      next.push(mapAssetToEvidence(asset, i));
    }
    onChange(next);
  };

  const handleCapture = async () => {
    if (remaining <= 0) {
      Alert.alert(
        'Đã đạt giới hạn',
        `Tối đa ${DISPUTE_MAX_EVIDENCE_FILES} tệp bằng chứng.`
      );
      return;
    }
    const res = await launchCamera({
      mediaType: 'mixed',
      durationLimit: DISPUTE_MAX_VIDEO_DURATION_SECONDS,
      quality: 0.8,
    });
    if (res.errorMessage) {
      Alert.alert('Lỗi camera', res.errorMessage);
      return;
    }
    appendAssets(res.assets);
  };

  const handlePickLibrary = async () => {
    if (remaining <= 0) {
      Alert.alert(
        'Đã đạt giới hạn',
        `Tối đa ${DISPUTE_MAX_EVIDENCE_FILES} tệp bằng chứng.`
      );
      return;
    }
    const res = await launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (res.errorMessage) {
      Alert.alert('Lỗi thư viện', res.errorMessage);
      return;
    }
    appendAssets(res.assets);
  };

  const handleRemove = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>
          Bằng chứng ảnh / video ({files.length}/{DISPUTE_MAX_EVIDENCE_FILES})
        </Text>
        <Text style={styles.hint}>Tối đa 20 MB/tệp · Video ≤ 60s</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.pickBtn, (disabled || remaining <= 0) && styles.btnDisabled]}
          onPress={() => void handleCapture()}
          disabled={disabled || remaining <= 0}
          accessibilityRole="button"
          accessibilityLabel="Chụp ảnh hoặc quay video"
        >
          <Camera size={18} color={tokens.colors.brandJade} />
          <Text style={styles.pickBtnText}>Chụp / Quay</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pickBtn, (disabled || remaining <= 0) && styles.btnDisabled]}
          onPress={() => void handlePickLibrary()}
          disabled={disabled || remaining <= 0}
          accessibilityRole="button"
          accessibilityLabel="Chọn ảnh hoặc video từ máy"
        >
          <FolderOpen size={18} color={tokens.colors.brandJade} />
          <Text style={styles.pickBtnText}>Chọn từ máy</Text>
        </TouchableOpacity>
      </View>

      {/* 5-slot Grid */}
      <View style={styles.grid}>
        {Array.from({ length: DISPUTE_MAX_EVIDENCE_FILES }).map((_, slotIdx) => {
          const item = files[slotIdx];
          if (!item) {
            return (
              <TouchableOpacity
                key={`slot-${slotIdx}`}
                style={styles.emptySlot}
                onPress={() => void handlePickLibrary()}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`Thêm bằng chứng ô ${slotIdx + 1}`}
              >
                <Plus size={20} color={tokens.colors.inkMuted} />
              </TouchableOpacity>
            );
          }

          return (
            <View key={item.id} style={styles.filledSlot}>
              {item.kind === 'VIDEO' ? (
                <View style={styles.videoTile}>
                  <VideoIcon size={22} color="#FFFFFF" />
                  <Text style={styles.videoLabel}>VIDEO</Text>
                </View>
              ) : (
                <Image source={{ uri: item.uri }} style={styles.thumb} />
              )}
              {!disabled ? (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemove(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Xóa ${item.fileName}`}
                >
                  <X size={14} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  hint: {
    fontSize: 12,
    color: tokens.colors.inkMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: tokens.spacing.touchTargetMin,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.brandJade,
    backgroundColor: tokens.colors.brandJadeSoft,
    paddingHorizontal: 12,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  pickBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptySlot: {
    width: 60,
    height: 60,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colors.borderHairline,
    backgroundColor: tokens.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filledSlot: {
    width: 60,
    height: 60,
    borderRadius: tokens.radii.sm,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: tokens.colors.subtle,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  videoTile: {
    flex: 1,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  videoLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  removeBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 42, 36, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
