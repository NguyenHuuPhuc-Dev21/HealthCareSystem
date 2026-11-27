import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  PlusCircle,
  QrCode,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserX,
} from 'lucide-react-native';
import {
  DEFAULT_MIN_NURSE_DEPOSIT_VND,
  type DepositPenaltyDto,
  type DepositRefundRequestDto,
  type DepositStatusDto,
  type DepositTopupLinkDto,
} from '@healthcare-system/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ActiveStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import {
  createDepositTopupLink,
  getDepositPenalties,
  getDepositStatus,
  getRefundRequest,
} from './deposit.api';
import { GraceProgressCard } from './components/GraceProgressCard';
import { PenaltyItem } from './components/PenaltyItem';
import { VietQrSheet } from './components/VietQrSheet';
import { useWalletSummary } from './useWalletSummary';

type DepositScreenNavigationProp = NativeStackNavigationProp<
  ActiveStackParamList,
  'Deposit'
>;

interface DepositScreenProps {
  navigation: DepositScreenNavigationProp;
}

export const DepositScreen: React.FC<DepositScreenProps> = ({ navigation }) => {
  const { refresh: refreshWalletSummary } = useWalletSummary();

  const [status, setStatus] = useState<
    (DepositStatusDto & { totalWithheld?: number }) | null
  >(null);
  const [penalties, setPenalties] = useState<DepositPenaltyDto[]>([]);
  const [refundRequest, setRefundRequest] = useState<DepositRefundRequestDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Top-up form state
  const [inputAmount, setInputAmount] = useState<string>('');
  const [creatingTopup, setCreatingTopup] = useState<boolean>(false);
  const [activeTopupLink, setActiveTopupLink] = useState<DepositTopupLinkDto | null>(null);
  const [qrSheetVisible, setQrSheetVisible] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const [stRes, penRes, refRes] = await Promise.all([
        getDepositStatus(),
        getDepositPenalties(),
        getRefundRequest(),
      ]);

      if (stRes.success && stRes.data) {
        setStatus(stRes.data);
        // Pre-fill top-up amount with shortfall if shortfall > 0
        if (stRes.data.shortfall > 0) {
          setInputAmount(stRes.data.shortfall.toString());
        } else {
          setInputAmount('');
        }
      }

      if (penRes.success && penRes.data) {
        setPenalties(penRes.data);
      }

      if (refRes.success) {
        setRefundRequest(refRes.data);
      }
    } catch {
      Alert.alert('Lỗi tải dữ liệu', 'Không thể tải thông tin ký quỹ lúc này.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refreshWalletSummary()]);
  };

  const minDeposit = status?.minDeposit ?? DEFAULT_MIN_NURSE_DEPOSIT_VND;
  const depositBalance = status?.depositBalance ?? 0;
  const shortfall = status?.shortfall ?? Math.max(minDeposit - depositBalance, 0);
  const isNegative = depositBalance < 0;
  const custodyPartner =
    status?.custodyPartnerName || 'BIDV — CN Sở Giao Dịch 1 (Lưu ký CareNest)';

  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((Math.max(0, depositBalance) / minDeposit) * 100))
  );

  // Xử lý tạo mã nạp VietQR
  const handleCreateTopup = async () => {
    const parsed = parseInt(inputAmount.replace(/\D/g, ''), 10);
    if (isNaN(parsed) || parsed < 10000) {
      Alert.alert('Số tiền không hợp lệ', 'Số tiền nạp tối thiểu là 10.000đ.');
      return;
    }

    if (parsed > shortfall) {
      Alert.alert(
        'Vượt mức ký quỹ',
        `Số tiền nạp tối đa là số còn thiếu (${shortfall.toLocaleString('vi-VN')}đ) để đạt đủ mức ${minDeposit.toLocaleString('vi-VN')}đ.`
      );
      return;
    }

    setCreatingTopup(true);
    try {
      const res = await createDepositTopupLink(parsed);
      if (res.success && res.data) {
        setActiveTopupLink(res.data);
        setQrSheetVisible(true);
      } else {
        Alert.alert(
          'Không thể tạo mã nạp',
          res.error?.message || 'Vui lòng kiểm tra lại số tiền nạp.'
        );
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể tạo mã nạp lúc này.');
    } finally {
      setCreatingTopup(false);
    }
  };

  // Quick amount selection
  const handleSelectQuickAmount = (amt: number) => {
    const capped = Math.min(amt, shortfall);
    setInputAmount(capped.toString());
  };

  const handleTopupSuccess = () => {
    setQrSheetVisible(false);
    setActiveTopupLink(null);
    void handleRefresh();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={24} color={tokens.colors.inkPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Ví ký quỹ</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Làm mới dữ liệu ký quỹ"
        >
          <RefreshCw size={20} color={tokens.colors.brandJade} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[tokens.colors.brandJade]}
            />
          }
        >
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={tokens.colors.brandJade} />
              <Text style={styles.loadingText}>Đang tải thông tin ký quỹ...</Text>
            </View>
          ) : (
            <>
              {/* 1. Thẻ Tóm Tắt Ký Quỹ & Đối Tác Lưu Ký */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryLabel}>SỐ DƯ KÝ QUỸ HIỆN TẠI</Text>
                  {depositBalance >= minDeposit ? (
                    <ShieldCheck size={20} color={tokens.colors.brandJade} />
                  ) : (
                    <ShieldAlert size={20} color={tokens.colors.alertCrimson} />
                  )}
                </View>

                <View style={styles.amountRow}>
                  {isNegative ? (
                    <Text style={styles.amountNegative}>
                      Đang nợ {Math.abs(depositBalance).toLocaleString('vi-VN')}đ
                    </Text>
                  ) : (
                    <Text style={styles.amountLarge}>
                      {depositBalance.toLocaleString('vi-VN')}đ
                    </Text>
                  )}
                  <Text style={styles.amountMax}>
                    / {minDeposit.toLocaleString('vi-VN')}đ
                  </Text>
                </View>

                {/* Thanh tiến trình */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressPercent}%` },
                      shortfall > 0 && styles.progressBarFillWarning,
                    ]}
                  />
                </View>

                {/* Badge trạng thái nhận ca */}
                <View style={styles.statusBadgeRow}>
                  {depositBalance >= minDeposit ? (
                    <View style={styles.statusBadgeFull}>
                      <ShieldCheck size={16} color="#15803D" />
                      <Text style={styles.statusBadgeFullText}>
                        Đã đủ ký quỹ — sẵn sàng nhận mọi ca mới
                      </Text>
                    </View>
                  ) : status?.grace.active ? (
                    <View style={styles.statusBadgeGrace}>
                      <Shield size={16} color="#0369A1" />
                      <Text style={styles.statusBadgeGraceText}>
                        Đang làm quen — nhận ca thanh toán chuyển khoản
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.statusBadgeShort}>
                      <ShieldAlert size={16} color={tokens.colors.alertCrimson} />
                      <Text style={styles.statusBadgeShortText}>
                        Chưa đủ ký quỹ — tạm ngưng nhận ca mới
                      </Text>
                    </View>
                  )}
                </View>

                {/* Thông tin đối tác giữ tiền độc lập (ADR-0004 D1) */}
                <View style={styles.custodyBox}>
                  <Building2 size={16} color={tokens.colors.brandJade} />
                  <View style={styles.custodyTextWrap}>
                    <Text style={styles.custodyTitle}>Đối tác lưu ký độc lập:</Text>
                    <Text style={styles.custodyDesc}>{custodyPartner}</Text>
                    <Text style={styles.custodySub}>
                      Tiền ký quỹ tách biệt với tài khoản vận hành CareNest, bảo toàn 100%.
                    </Text>
                  </View>
                </View>
              </View>

              {/* 2. Thẻ Ân Hạn Làm Quen (nếu có) */}
              {status && (
                <View style={styles.sectionWrap}>
                  <GraceProgressCard status={status} />
                </View>
              )}

              {/* 3. Khối Nạp Bù Ký Quỹ Qua VietQR */}
              {shortfall > 0 ? (
                <View style={styles.topupSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <QrCode size={20} color={tokens.colors.brandJade} />
                    <Text style={styles.sectionTitle}>Nạp bổ sung ký quỹ</Text>
                  </View>
                  <Text style={styles.topupSubtitle}>
                    Số tiền cần nạp bù:{' '}
                    <Text style={styles.boldAmount}>
                      {shortfall.toLocaleString('vi-VN')}đ
                    </Text>
                  </Text>

                  {/* Input số tiền */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.currencyPrefix}>đ</Text>
                    <TextInput
                      style={styles.amountInput}
                      keyboardType="numeric"
                      value={inputAmount}
                      onChangeText={setInputAmount}
                      placeholder={shortfall.toString()}
                      placeholderTextColor={tokens.colors.inkMuted}
                    />
                  </View>

                  {/* Quick selection chips */}
                  <View style={styles.chipsRow}>
                    {shortfall >= 50000 && (
                      <TouchableOpacity
                        style={styles.chipBtn}
                        onPress={() => handleSelectQuickAmount(50000)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.chipBtnText}>50.000đ</Text>
                      </TouchableOpacity>
                    )}
                    {shortfall >= 100000 && (
                      <TouchableOpacity
                        style={styles.chipBtn}
                        onPress={() => handleSelectQuickAmount(100000)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.chipBtnText}>100.000đ</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.chipBtn, styles.chipBtnSelected]}
                      onPress={() => handleSelectQuickAmount(shortfall)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipBtnText, styles.chipBtnSelectedText]}>
                        Đủ {shortfall.toLocaleString('vi-VN')}đ
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Nút Tạo mã VietQR */}
                  <TouchableOpacity
                    style={styles.btnCreateTopup}
                    onPress={handleCreateTopup}
                    disabled={creatingTopup}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Tạo mã nạp VietQR"
                  >
                    {creatingTopup ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <QrCode size={20} color="#FFFFFF" />
                        <Text style={styles.btnCreateTopupText}>Tạo mã nạp qua VietQR</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* 4. Danh Sách Khoản Trừ Phạt Ký Quỹ */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Lịch sử phạt vi phạm SLA</Text>
                  {penalties.length > 3 && (
                    <Text style={styles.countBadge}>{penalties.length} khoản</Text>
                  )}
                </View>

                {penalties.length === 0 ? (
                  <View style={styles.emptyPenaltiesBox}>
                    <ShieldCheck size={36} color={tokens.colors.brandJade} />
                    <Text style={styles.emptyTitle}>Ký quỹ nguyên vẹn</Text>
                    <Text style={styles.emptyDesc}>
                      Bạn chưa có khoản trừ phạt SLA nào. Ký quỹ được bảo toàn 100%.
                    </Text>
                  </View>
                ) : (
                  penalties.map((pen) => (
                    <PenaltyItem
                      key={pen.transactionId}
                      penalty={pen}
                      onPress={(item) =>
                        navigation.navigate('PenaltyDetail', {
                          transactionId: item.transactionId,
                        })
                      }
                    />
                  ))
                )}
              </View>

              {/* 5. Cửa Ngõ Ngừng Hợp Tác & Hoàn Ký Quỹ (ADR-0004) */}
              <TouchableOpacity
                style={styles.closureLinkCard}
                onPress={() => navigation.navigate('AccountClosure')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Ngừng hợp tác và hoàn ký quỹ"
              >
                <View style={styles.closureLeft}>
                  <View style={styles.closureIconBox}>
                    <UserX size={20} color={tokens.colors.alertCrimson} />
                  </View>
                  <View style={styles.closureTextWrap}>
                    <Text style={styles.closureTitle}>Ngừng hợp tác và hoàn ký quỹ</Text>
                    <Text style={styles.closureDesc}>
                      {refundRequest && refundRequest.status !== 'CANCELLED'
                        ? 'Đang có yêu cầu hoàn tiền đang xử lý'
                        : 'Hoàn lại số dư ký quỹ về tài khoản ngân hàng sau 7 ngày'}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color={tokens.colors.inkSecondary} />
              </TouchableOpacity>

              {/* 6. Ghi Chú Quy Tắc Ký Quỹ Theo W02 bước 7 */}
              <View style={styles.ruleNotesCard}>
                <View style={styles.ruleHeader}>
                  <HelpCircle size={18} color={tokens.colors.brandJade} />
                  <Text style={styles.ruleTitle}>Quy chuẩn vận hành ký quỹ</Text>
                </View>
                <Text style={styles.ruleItem}>
                  • <Text style={styles.ruleBold}>Mục đích duy nhất:</Text> Ký quỹ chỉ dùng để bảo
                  đảm cam kết dịch vụ (SLA) như hủy ca gấp hoặc vắng mặt không báo trước.
                </Text>
                <Text style={styles.ruleItem}>
                  • <Text style={styles.ruleBold}>Hoa hồng sàn:</Text> Tuyệt đối{' '}
                  <Text style={styles.ruleBold}>KHÔNG trừ vào ví ký quỹ</Text>. Điều dưỡng tự nộp
                  15% hoa hồng ca tiền mặt tại mục "Nộp hoa hồng".
                </Text>
                <Text style={styles.ruleItem}>
                  • <Text style={styles.ruleBold}>Quyền khiếu nại:</Text> Mọi khoản trừ đều có mã
                  đơn, điều khoản SLA cụ thể và thời hạn khiếu nại 3 ngày.
                </Text>
                <Text style={styles.ruleItem}>
                  • <Text style={styles.ruleBold}>Hoàn tiền khi rời sàn:</Text> Hoàn 100% số dư ký
                  quỹ còn lại sau 7 ngày kể từ ca trực cuối cùng không có tranh chấp.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal / Bottom Sheet VietQR */}
      {activeTopupLink && (
        <VietQrSheet
          visible={qrSheetVisible}
          topupLink={activeTopupLink}
          onSuccess={handleTopupSuccess}
          onClose={() => setQrSheetVisible(false)}
          onRecreate={handleCreateTopup}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  flex: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  backBtn: {
    padding: 6,
  },
  headerBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  refreshBtn: {
    padding: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  centerBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: tokens.colors.inkSecondary,
  },
  summaryCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: tokens.colors.inkSecondary,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 12,
  },
  amountLarge: {
    fontSize: 32,
    fontWeight: '900',
    color: tokens.colors.brandJadeDark,
  },
  amountNegative: {
    fontSize: 26,
    fontWeight: '900',
    color: tokens.colors.alertCrimson,
  },
  amountMax: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: tokens.colors.subtle,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: tokens.colors.brandJade,
    borderRadius: 5,
  },
  progressBarFillWarning: {
    backgroundColor: tokens.colors.accentOchre,
  },
  statusBadgeRow: {
    marginBottom: 16,
  },
  statusBadgeFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusBadgeFullText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#15803D',
    flex: 1,
  },
  statusBadgeGrace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E0F2FE',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusBadgeGraceText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0369A1',
    flex: 1,
  },
  statusBadgeShort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusBadgeShortText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: tokens.colors.alertCrimson,
    flex: 1,
  },
  custodyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: tokens.colors.subtle,
    padding: 12,
    borderRadius: 12,
  },
  custodyTextWrap: {
    flex: 1,
  },
  custodyTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  custodyDesc: {
    fontSize: 13.5,
    fontWeight: '800',
    color: tokens.colors.brandJadeDark,
    marginTop: 1,
  },
  custodySub: {
    fontSize: 12,
    color: tokens.colors.inkSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  sectionWrap: {
    marginBottom: 0,
  },
  topupSectionCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.lg,
    padding: 18,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  topupSubtitle: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    marginBottom: 12,
  },
  boldAmount: {
    fontWeight: '800',
    color: tokens.colors.alertCrimson,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.canvas,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    height: 48,
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: tokens.colors.subtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  chipBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  chipBtnSelected: {
    backgroundColor: tokens.colors.brandJadeSoft,
    borderColor: tokens.colors.brandJade,
  },
  chipBtnSelectedText: {
    color: tokens.colors.brandJadeDark,
  },
  btnCreateTopup: {
    backgroundColor: tokens.colors.brandJade,
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnCreateTopupText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  countBadge: {
    marginLeft: 'auto',
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    fontWeight: '600',
  },
  emptyPenaltiesBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    marginTop: 4,
  },
  emptyDesc: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  closureLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  closureLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  closureIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closureTextWrap: {
    flex: 1,
  },
  closureTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  closureDesc: {
    fontSize: 12.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  ruleNotesCard: {
    backgroundColor: tokens.colors.subtle,
    borderRadius: tokens.radii.md,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  ruleTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  ruleItem: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    lineHeight: 19,
    marginBottom: 6,
  },
  ruleBold: {
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
});
