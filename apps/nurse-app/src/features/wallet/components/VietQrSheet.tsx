import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Clipboard,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  AlertCircle,
  Building,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  QrCode,
  RefreshCw,
  X,
} from 'lucide-react-native';
import { TxStatus } from '@healthcare-system/shared';
import type { DepositTopupLinkDto } from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';
import { getTopupStatus } from '../deposit.api';

export interface GenericVietQrLink {
  id?: string;
  amount: number;
  qrImageUrl?: string;
  bankName: string;
  accountNumber: string;
  transferContent: string;
  expiresAt: string;
  deeplinkUrl?: string;
}

export interface VietQrSheetProps {
  visible: boolean;
  topupLink?: DepositTopupLinkDto | null;
  paymentLink?: GenericVietQrLink | null;
  title?: string;
  onSuccess: () => void;
  onClose: () => void;
  onRecreate?: () => void;
}

function formatCountdown(expiresAt: string): { text: string; isExpired: boolean } {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return { text: '00:00', isExpired: true };

  const totalSecs = Math.floor(diffMs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return {
    text: `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
    isExpired: false,
  };
}

export const VietQrSheet: React.FC<VietQrSheetProps> = ({
  visible,
  topupLink,
  paymentLink,
  title,
  onSuccess,
  onClose,
  onRecreate,
}) => {
  const data: GenericVietQrLink = paymentLink || {
    id: topupLink?.topupId,
    amount: topupLink?.amount || 0,
    qrImageUrl: topupLink?.qrImageUrl,
    bankName: topupLink?.bankName || 'BIDV — CN Sở Giao Dịch 1 (Lưu ký CareNest)',
    accountNumber: topupLink?.accountNumber || '12410006899999',
    transferContent: topupLink?.transferContent || '',
    expiresAt: topupLink?.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{ text: string; isExpired: boolean }>(() =>
    formatCountdown(data.expiresAt)
  );
  const [status, setStatus] = useState<TxStatus>(TxStatus.PENDING);
  const [checking, setChecking] = useState<boolean>(false);

  const topupId = data.id;

  // Function to poll topup status
  const checkStatus = useCallback(async () => {
    if (!topupId || status === TxStatus.COMPLETED || countdown.isExpired) return;
    try {
      setChecking(true);
      const res = await getTopupStatus(topupId);
      if (res.success && res.data.status === TxStatus.COMPLETED) {
        setStatus(TxStatus.COMPLETED);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch {
      // ignore transient polling errors
    } finally {
      setChecking(false);
    }
  }, [topupId, status, countdown.isExpired, onSuccess]);

  // Timer countdown 1s
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => {
      const res = formatCountdown(data.expiresAt);
      setCountdown(res);
      if (res.isExpired) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, data.expiresAt]);

  // Polling loop every 5s while visible and not expired
  useEffect(() => {
    if (!visible || !topupId || status === TxStatus.COMPLETED || countdown.isExpired) return;
    const pollInterval = setInterval(() => {
      void checkStatus();
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [visible, topupId, status, countdown.isExpired, checkStatus]);

  // AppState listener: when coming back to app, check immediately
  useEffect(() => {
    if (!visible || !topupId || status === TxStatus.COMPLETED || countdown.isExpired) return;
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void checkStatus();
      }
    });
    return () => subscription.remove();
  }, [visible, topupId, status, countdown.isExpired, checkStatus]);

  const handleCopy = (field: string, text: string) => {
    Clipboard.setString(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenBankApp = async () => {
    // If deeplink is provided or try banking scheme
    const deeplink = data.deeplinkUrl || 'vietqr://pay';
    try {
      const canOpen = await Linking.canOpenURL(deeplink);
      if (canOpen) {
        await Linking.openURL(deeplink);
        return;
      }
    } catch {
      // fallback
    }

    Alert.alert(
      'Mở ứng dụng ngân hàng',
      'Vui lòng mở ứng dụng ngân hàng bạn đang dùng (Vietcombank, MB, BIDV, v.v.) và thực hiện quét mã QR hoặc chuyển khoản theo thông tin bên dưới.',
      [{ text: 'Đã hiểu' }]
    );
  };

  const handleSaveQrImage = () => {
    Alert.alert(
      'Lưu ảnh QR',
      'Đã lưu thông tin mã QR chuyển khoản vào thiết bị. Bạn có thể mở ứng dụng ngân hàng và tải ảnh lên từ thư viện.',
      [{ text: 'Xong' }]
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.titleRow}>
              <QrCode size={22} color={tokens.colors.brandJade} />
              <Text style={styles.sheetTitle}>{title || 'Mã VietQR nạp ký quỹ'}</Text>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Đóng mã QR"
            >
              <X size={22} color={tokens.colors.inkSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            {/* Countdown Badge */}
            <View style={styles.countdownRow}>
              <View
                style={[
                  styles.countdownBadge,
                  countdown.isExpired ? styles.badgeExpired : styles.badgeActive,
                ]}
              >
                <Clock
                  size={15}
                  color={countdown.isExpired ? tokens.colors.alertCrimson : tokens.colors.accentOchre}
                />
                <Text
                  style={[
                    styles.countdownText,
                    countdown.isExpired ? styles.textExpired : styles.textActive,
                  ]}
                >
                  {countdown.isExpired ? 'Đã hết hạn' : `Hết hạn sau: ${countdown.text}`}
                </Text>
              </View>
            </View>

            {/* Trạng thái thành công */}
            {status === TxStatus.COMPLETED ? (
              <View style={styles.successBox}>
                <CheckCircle2 size={48} color="#16A34A" />
                <Text style={styles.successTitle}>Nạp ký quỹ thành công!</Text>
                <Text style={styles.successDesc}>
                  Hệ thống đã nhận {data.amount.toLocaleString('vi-VN')}đ và cập nhật số dư ký quỹ của bạn.
                </Text>
              </View>
            ) : countdown.isExpired ? (
              <View style={styles.expiredBox}>
                <AlertCircle size={40} color={tokens.colors.alertCrimson} />
                <Text style={styles.expiredTitle}>Mã nạp VietQR đã hết hạn</Text>
                <Text style={styles.expiredDesc}>
                  Vui lòng không chuyển khoản vào mã này để tránh giao dịch bị treo.
                </Text>
                {onRecreate ? (
                  <TouchableOpacity
                    style={styles.btnRecreate}
                    onPress={onRecreate}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Tạo lại mã nạp"
                  >
                    <RefreshCw size={16} color="#FFFFFF" />
                    <Text style={styles.btnRecreateText}>Tạo lại mã nạp</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <>
                {/* QR Code Container */}
                <View style={styles.qrWrapper}>
                  {data.qrImageUrl ? (
                    <Image
                      source={{ uri: data.qrImageUrl }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.qrSvgBox}>
                      <QRCode
                        value={data.transferContent || `BIDV:${data.accountNumber}:${data.amount}`}
                        size={180}
                        color={tokens.colors.inkPrimary}
                        backgroundColor="#FFFFFF"
                      />
                    </View>
                  )}
                  <Text style={styles.qrSub}>Quét bằng ứng dụng ngân hàng bất kỳ</Text>
                </View>

                {/* 3 Nút Thao Tác Chuyên Biệt Cho Mobile (A10) */}
                <View style={styles.actionButtonsCol}>
                  <TouchableOpacity
                    style={styles.btnPrimaryAction}
                    onPress={handleOpenBankApp}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Mở ứng dụng ngân hàng"
                  >
                    <ExternalLink size={18} color="#FFFFFF" />
                    <Text style={styles.btnPrimaryText}>Mở app ngân hàng</Text>
                  </TouchableOpacity>

                  <View style={styles.btnRowDouble}>
                    <TouchableOpacity
                      style={styles.btnSecondaryAction}
                      onPress={handleSaveQrImage}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Lưu ảnh QR"
                    >
                      <Download size={17} color={tokens.colors.brandJade} />
                      <Text style={styles.btnSecondaryText}>Lưu ảnh QR</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnSecondaryAction}
                      onPress={() => handleCopy('content', data.transferContent)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Sao chép nội dung chuyển khoản"
                    >
                      {copiedField === 'content' ? (
                        <Check size={17} color="#16A34A" />
                      ) : (
                        <Copy size={17} color={tokens.colors.brandJade} />
                      )}
                      <Text style={styles.btnSecondaryText}>
                        {copiedField === 'content' ? 'Đã chép nội dung' : 'Sao chép nội dung'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Bảng Chi Tiết Chuyển Khoản */}
                <View style={styles.infoTable}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Ngân hàng thụ hưởng</Text>
                    <Text style={styles.infoValue}>{data.bankName}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Số tài khoản</Text>
                    <View style={styles.valWithCopy}>
                      <Text style={[styles.infoValue, styles.infoValueBold]}>
                        {data.accountNumber}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleCopy('account', data.accountNumber)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Sao chép số tài khoản"
                      >
                        {copiedField === 'account' ? (
                          <Check size={16} color="#16A34A" />
                        ) : (
                          <Copy size={16} color={tokens.colors.brandJade} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Số tiền nạp</Text>
                    <View style={styles.valWithCopy}>
                      <Text style={[styles.infoValue, styles.amountHighlight]}>
                        {data.amount.toLocaleString('vi-VN')}đ
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleCopy('amount', data.amount.toString())}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Sao chép số tiền"
                      >
                        {copiedField === 'amount' ? (
                          <Check size={16} color="#16A34A" />
                        ) : (
                          <Copy size={16} color={tokens.colors.brandJade} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.infoRow, styles.infoRowLast]}>
                    <Text style={styles.infoLabel}>Nội dung chuyển khoản</Text>
                    <View style={styles.valWithCopy}>
                      <Text style={[styles.infoValue, styles.infoValueCode]}>
                        {data.transferContent}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleCopy('content_table', data.transferContent)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Sao chép nội dung"
                      >
                        {copiedField === 'content_table' ? (
                          <Check size={16} color="#16A34A" />
                        ) : (
                          <Copy size={16} color={tokens.colors.brandJade} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Hướng dẫn nhận diện */}
                <View style={styles.noteBox}>
                  <Text style={styles.noteText}>
                    💡 Tiền sẽ được cộng tự động vào Ví ký quỹ sau 5–15 giây kể từ khi ngân hàng hoàn
                    tất chuyển khoản. Màn hình sẽ tự động cập nhật và đóng lại.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: tokens.colors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  closeBtn: {
    padding: 6,
  },
  scrollBody: {
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 14,
    paddingBottom: 24,
  },
  countdownRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeActive: {
    backgroundColor: tokens.colors.accentOchreSoft,
  },
  badgeExpired: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  countdownText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  textActive: {
    color: '#92400E',
  },
  textExpired: {
    color: tokens.colors.alertCrimson,
  },
  qrWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: tokens.colors.subtle,
  },
  qrSvgBox: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: tokens.colors.borderHairline,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  qrSub: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    marginTop: 8,
  },
  actionButtonsCol: {
    gap: 10,
    marginBottom: 18,
  },
  btnPrimaryAction: {
    backgroundColor: tokens.colors.brandJade,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  btnRowDouble: {
    flexDirection: 'row',
    gap: 10,
  },
  btnSecondaryAction: {
    flex: 1,
    backgroundColor: tokens.colors.brandJadeSoft,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.colors.brandJade,
  },
  btnSecondaryText: {
    color: tokens.colors.brandJadeDark,
    fontSize: 14,
    fontWeight: '700',
  },
  infoTable: {
    backgroundColor: tokens.colors.canvas,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  infoRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  infoLabel: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
  },
  infoValue: {
    fontSize: 14,
    color: tokens.colors.inkPrimary,
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },
  infoValueBold: {
    fontWeight: '800',
  },
  infoValueCode: {
    color: tokens.colors.brandJadeDark,
    fontWeight: '800',
  },
  amountHighlight: {
    fontSize: 16,
    fontWeight: '900',
    color: tokens.colors.brandJadeDark,
  },
  valWithCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteBox: {
    padding: 12,
    backgroundColor: tokens.colors.subtle,
    borderRadius: 10,
  },
  noteText: {
    fontSize: 12.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 18,
  },
  successBox: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginVertical: 12,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#166534',
    marginTop: 12,
    marginBottom: 6,
  },
  successDesc: {
    fontSize: 14.5,
    color: '#15803D',
    textAlign: 'center',
    lineHeight: 20,
  },
  expiredBox: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.alertCrimson,
    marginVertical: 12,
  },
  expiredTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.alertCrimson,
    marginTop: 10,
    marginBottom: 6,
  },
  expiredDesc: {
    fontSize: 14,
    color: '#7F1D1D',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  btnRecreate: {
    backgroundColor: tokens.colors.brandJade,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 48,
  },
  btnRecreateText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
