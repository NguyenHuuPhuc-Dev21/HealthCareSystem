import React, { useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Maximize2, Play, Video as VideoIcon, X } from 'lucide-react-native';
import Video from 'react-native-video';
import type { DisputeEvidenceDto } from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';

export interface EvidenceGalleryProps {
  evidences: DisputeEvidenceDto[];
  emptyText?: string;
}

export const EvidenceGallery: React.FC<EvidenceGalleryProps> = ({
  evidences,
  emptyText = 'Không có bằng chứng đính kèm.',
}) => {
  const [selected, setSelected] = useState<DisputeEvidenceDto | null>(null);

  if (evidences.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <>
      <View style={styles.grid}>
        {evidences.map((ev) => (
          <TouchableOpacity
            key={ev.id}
            style={styles.tile}
            onPress={() => setSelected(ev)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Xem bằng chứng ${ev.fileName || ev.id}`}
          >
            {ev.kind === 'VIDEO' ? (
              <View style={styles.videoTile}>
                <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.videoTag}>VIDEO</Text>
              </View>
            ) : (
              <Image source={{ uri: ev.url }} style={styles.thumb} />
            )}
            <View style={styles.expandBadge}>
              {ev.kind === 'VIDEO' ? (
                <VideoIcon size={12} color="#FFFFFF" />
              ) : (
                <Maximize2 size={12} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Modal
        visible={selected !== null}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {selected?.fileName || 'Bằng chứng'}
            </Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSelected(null)}
              accessibilityRole="button"
              accessibilityLabel="Đóng trình xem bằng chứng"
            >
              <X size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            {selected?.kind === 'VIDEO' ? (
              <Video
                source={{ uri: selected.url }}
                style={styles.fullscreenMedia}
                controls
                resizeMode="contain"
              />
            ) : selected ? (
              <Image
                source={{ uri: selected.url }}
                style={styles.fullscreenMedia}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  emptyText: {
    fontSize: 14,
    color: tokens.colors.inkMuted,
    fontStyle: 'italic',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: 86,
    height: 86,
    borderRadius: tokens.radii.sm,
    overflow: 'hidden',
    backgroundColor: tokens.colors.subtle,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    position: 'relative',
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
    gap: 4,
  },
  videoTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  expandBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 42, 36, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 12,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenMedia: {
    width: '100%',
    height: '100%',
  },
});
