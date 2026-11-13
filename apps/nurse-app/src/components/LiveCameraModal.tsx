import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import {
  registerCameraCaptureHandler,
  type CameraFacing,
  type LiveCameraCaptureOptions,
} from '../lib/hardware-providers';
import { tokens } from '../styles/tokens';
import { AppButton } from './AppButton';

interface PendingCapture {
  facing: CameraFacing;
  instruction: string;
  resolve: (uri: string | null) => void;
}

/**
 * Provides direct-only camera capture via react-native-vision-camera.
 * Gallery selection is intentionally omitted per SRS anti-fraud requirement (FR-SHIFT-01).
 */
export const LiveCameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<PendingCapture | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const cameraRef = useRef<Camera>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice(pending?.facing ?? 'front');

  const requestCapture = useCallback((options?: LiveCameraCaptureOptions) => {
    setCameraError(null);
    return new Promise<string | null>((resolve) => {
      setPending({
        facing: options?.facing ?? 'front',
        instruction:
          options?.instruction ??
          'Chụp ảnh trực tiếp tại nơi làm việc (không hỗ trợ chọn ảnh từ thư viện).',
        resolve,
      });
    });
  }, []);

  useEffect(() => {
    registerCameraCaptureHandler(requestCapture);
    return () => registerCameraCaptureHandler(null);
  }, [requestCapture]);

  useEffect(() => {
    if (pending && !hasPermission) {
      void requestPermission();
    }
  }, [pending, hasPermission, requestPermission]);

  const handleClose = () => {
    if (pending) {
      pending.resolve(null);
      setPending(null);
    }
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    setCameraError(null);
    try {
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
      });
      const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      pending?.resolve(uri);
      setPending(null);
    } catch {
      setCameraError('Không chụp được ảnh từ camera. Vui lòng thử lại.');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <>
      {children}
      <Modal
        visible={Boolean(pending)}
        animationType="slide"
        onRequestClose={handleClose}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Chụp ảnh xác thực trực tiếp</Text>
            <Text style={styles.subtitle}>{pending?.instruction}</Text>
          </View>

          <View style={styles.viewport}>
            {!hasPermission ? (
              <View style={styles.fallbackBox}>
                <Text style={styles.fallbackText}>
                  Ứng dụng cần quyền Camera để chụp ảnh trực tiếp.
                </Text>
                <AppButton
                  label="Cấp quyền Camera"
                  onPress={() => {
                    void requestPermission().then((granted) => {
                      if (!granted) void Linking.openSettings();
                    });
                  }}
                />
              </View>
            ) : !device ? (
              <View style={styles.fallbackBox}>
                <Text style={styles.fallbackText}>
                  Không tìm thấy camera {pending?.facing === 'front' ? 'trước' : 'sau'} trên thiết bị.
                </Text>
              </View>
            ) : (
              <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={Boolean(pending)}
                photo
              />
            )}
          </View>

          {cameraError ? <Text style={styles.errorText}>{cameraError}</Text> : null}

          <View style={styles.footer}>
            <AppButton
              label="Hủy"
              variant="secondary"
              onPress={handleClose}
              style={styles.footerBtn}
            />
            <AppButton
              label={capturing ? 'Đang lưu ảnh...' : 'Chụp ảnh ngay'}
              onPress={() => void handleTakePhoto()}
              disabled={!hasPermission || !device}
              loading={capturing}
              style={styles.footerBtnPrimary}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1A17',
  },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14.5,
    color: '#D8E0DC',
    lineHeight: 20,
  },
  viewport: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1B2E29',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackBox: {
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  fallbackText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 23,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14.5,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  footerBtn: {
    flex: 1,
    backgroundColor: tokens.colors.paper,
  },
  footerBtnPrimary: {
    flex: 1.5,
  },
});

