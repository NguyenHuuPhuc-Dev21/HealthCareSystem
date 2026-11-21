import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, FileCheck2, X, ZoomIn, ZoomOut } from 'lucide-react-native';
import { tokens } from '../../../styles/tokens';

export interface PrescriptionViewerProps {
  visible: boolean;
  imageUrl?: string;
  fileName?: string;
  prescribedDate?: string;
  expiryDays?: number;
  onClose: () => void;
}

export const PrescriptionViewer: React.FC<PrescriptionViewerProps> = ({
  visible,
  imageUrl,
  fileName,
  prescribedDate,
  expiryDays = 7,
  onClose,
}) => {
  const [scale, setScale] = useState<number>(1);
  const [imageLoading, setImageLoading] = useState<boolean>(true);

  const toggleZoom = () => {
    setScale((prev) => (prev === 1 ? 2 : prev === 2 ? 3 : 1));
  };

  const defaultMockUri =
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1000';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.titleArea}>
            <FileCheck2 size={20} color={tokens.colors.brandJade} />
            <Text style={styles.titleText}>Y lệnh / Đơn thuốc gốc</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Đóng xem đơn thuốc"
          >
            <X size={24} color={tokens.colors.inkPrimary} />
          </TouchableOpacity>
        </View>

        {/* Metadata info */}
        <View style={styles.metaBox}>
          <Text style={styles.fileName}>{fileName || 'ylenh_dieu_tri.jpg'}</Text>
          <View style={styles.metaRow}>
            <Calendar size={14} color={tokens.colors.inkSecondary} />
            <Text style={styles.metaText}>
              Ngày kê: {prescribedDate || 'Mới đây'} · Còn hạn: {expiryDays} ngày
            </Text>
          </View>
        </View>

        {/* Image Viewer Area */}
        <View style={styles.imageContainer}>
          <ScrollView
            maximumZoomScale={3}
            minimumZoomScale={1}
            contentContainerStyle={styles.scrollContent}
            centerContent
          >
            <Image
              source={{ uri: imageUrl || defaultMockUri }}
              style={[
                styles.image,
                { transform: [{ scale }] },
              ]}
              resizeMode="contain"
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
            />
            {imageLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={tokens.colors.brandJade} />
                <Text style={styles.loadingText}>Đang tải ảnh y lệnh...</Text>
              </View>
            )}
          </ScrollView>

          {/* Floating Zoom Control */}
          <TouchableOpacity
            style={styles.zoomFab}
            onPress={toggleZoom}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Phóng to hoặc thu nhỏ ảnh"
          >
            {scale > 1 ? (
              <ZoomOut size={22} color="#FFFFFF" />
            ) : (
              <ZoomIn size={22} color="#FFFFFF" />
            )}
            <Text style={styles.zoomFabText}>{scale}x</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.bottomCloseButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.bottomCloseText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  titleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  metaBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
  },
  fileName: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 360,
    height: 480,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#F8FAFC',
  },
  zoomFab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.brandJade,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  zoomFabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bottomBar: {
    padding: 16,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  bottomCloseButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
