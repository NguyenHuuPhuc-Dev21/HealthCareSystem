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
  type CameraCaptureMode,
  type CameraFacing,
  type LiveCameraCaptureOptions,
} from '../lib/hardware-providers';
import { tokens } from '../styles/tokens';
import { AppButton } from './AppButton';

interface PendingCapture {
  facing: CameraFacing;
  instruction: string;
  mode: CameraCaptureMode;
  resolve: (uri: string | null) => void;
}

/**
 * Provides direct-only camera capture via react-native-vision-camera.
 * Supports 'document' mode (rear camera, card aspect-ratio guide frame)
 * and 'selfie' mode (front camera, face guide frame).
 * Gallery selection is intentionally omitted per SRS anti-fraud requirement (FR-AUTH-01 / FR-SHIFT-01).
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
    const mode = options?.mode ?? (options?.facing === 'back' ? 'document' : 'selfie');
    const defaultFacing: CameraFacing = mode === 'document' ? 'back' : 'front';
    const defaultInstruction =
      mode === 'document'
        ? 'Đặt giấy tờ ngay ngắn trong khung hình chữ nhật và chụp rõ nét.'
        : 'Chụp ảnh trực tiếp khuôn mặt của bạn (không hỗ trợ chọn ảnh từ thư viện).';

    return new Promise<string | null>((resolve) => {
      setPending({
        facing: options?.facing ?? defaultFacing,
        mode,
        instruction: options?.instruction ?? defaultInstruction,
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

  const isDocumentMode = pending?.mode === 'document';

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
            <Text style={styles.title}>
              {isDocumentMode ? 'Chụp ảnh tài liệu trực tiếp' : 'Chụp ảnh chân dung trực tiếp'}
            </Text>
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
              <>
                <Camera
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  device={device}
                  isActive={Boolean(pending)}
                  photo
                />
                {/* Guide Frame Overlay */}
                <View style={styles.overlayContainer} pointerEvents="none">
                  {isDocumentMode ? (
                    <View style={styles.documentFrame}>
                      <View style={[styles.corner, styles.topLeft]} />
                      <View style={[styles.corner, styles.topRight]} />
                      <View style={[styles.corner, styles.bottomLeft]} />
                      <View style={[styles.corner, styles.bottomRight]} />
                      <Text style={styles.frameLabel}>Căn chỉnh giấy tờ vừa khớp khung này</Text>
                    </View>
                  ) : (
                    <View style={styles.selfieFrame}>
                      <Text style={styles.frameLabel}>Căn chỉnh khuôn mặt vào giữa khung</Text>
                    </View>
                  )}
                </View>
              </>
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
    position: 'relative',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  documentFrame: {
    width: '90%',
    aspectRatio: 1.58, // Standard ID Card aspect ratio (85.6mm / 53.98mm)
    borderWidth: 2,
    borderColor: '#34D399',
    borderRadius: 12,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 12,
    position: 'relative',
  },
  selfieFrame: {
    width: '74%',
    aspectRatio: 0.78, // Oval / Portrait aspect ratio
    borderWidth: 2.5,
    borderColor: '#34D399',
    borderRadius: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 18,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  frameLabel: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
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

