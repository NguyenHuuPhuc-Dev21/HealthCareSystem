import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Info,
  ShieldAlert,
  X,
} from 'lucide-react-native';
import {
  DepositRefundStatus,
  type DepositRefundRequestDto,
  type DepositStatusDto,
} from '@healthcare-system/shared';
import { tokens } from '../styles/tokens';

export type BannerKind = 'danger' | 'info' | 'neutral' | 'warning';

export interface DepositBannerMeta {
  show: boolean;
  kind: BannerKind;
  title: string;
  message: string;
  actionLabel?: string;
  actionRoute?: 'Deposit' | 'AccountClosure';
}

/**
 * Deterministic helper to decide deposit banner state from DepositStatusDto
 */
export function getDepositBannerMeta(
  status?: DepositStatusDto | null,
  refundRequest?: DepositRefundRequestDto | null
): DepositBannerMeta | null {
  if (!status) return null;

  // 1. Đang đóng tài khoản / yêu cầu hoàn tiền
  if (refundRequest && refundRequest.status !== DepositRefundStatus.CANCELLED) {
    return {
      show: true,
      kind: 'neutral',
      title: 'Đang xử lý ngừng hợp tác',
      message: 'Tài khoản đang trong quy trình tất toán và chờ hoàn ký quỹ.',
      actionLabel: 'Xem chi tiết',
      actionRoute: 'AccountClosure',
    };
  }

  // 2. Ký quỹ chưa đủ và không trong ân hạn (tạm ngưng nhận ca)
  if (status.depositBalance < status.minDeposit && !status.grace.active) {
    const shortfallFormatted = status.shortfall.toLocaleString('vi-VN');
    return {
      show: true,
      kind: 'danger',
      title: 'Chưa đủ ký quỹ — Tạm khóa nhận ca',
      message: `Thiếu ${shortfallFormatted}đ so với mức tối thiểu ${status.minDeposit.toLocaleString(
        'vi-VN'
      )}đ. Nạp bù để tiếp tục nhận ca.`,
      actionLabel: `Nạp bù ${shortfallFormatted}đ`,
      actionRoute: 'Deposit',
    };
  }

  // 3. Đang trong ân hạn (grace)
  if (status.grace.active) {
    return {
      show: true,
      kind: 'info',
      title: `Đang làm quen — Ân hạn ${status.grace.shiftsUsed}/${status.grace.maxShifts} ca`,
      message: 'Chỉ nhận ca chuyển khoản, trích 30% thu nhập tích lũy vào ký quỹ.',
      actionLabel: 'Xem ký quỹ',
      actionRoute: 'Deposit',
    };
  }

  return null;
}

export interface AppBannerProps {
  kind?: BannerKind;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const AppBanner: React.FC<AppBannerProps> = ({
  kind = 'info',
  title,
  message,
  actionLabel,
  onAction,
  onClose,
  style,
}) => {
  const getKindStyle = () => {
    switch (kind) {
      case 'danger':
        return {
          container: styles.bannerDanger,
          title: styles.textDanger,
          message: styles.textDangerSub,
          button: styles.btnDanger,
          btnText: styles.btnDangerText,
          icon: <ShieldAlert size={18} color={tokens.colors.alertCrimson} />,
        };
      case 'warning':
        return {
          container: styles.bannerWarning,
          title: styles.textWarning,
          message: styles.textWarningSub,
          button: styles.btnWarning,
          btnText: styles.btnWarningText,
          icon: <AlertTriangle size={18} color={tokens.colors.accentOchre} />,
        };
      case 'neutral':
        return {
          container: styles.bannerNeutral,
          title: styles.textNeutral,
          message: styles.textNeutralSub,
          button: styles.btnNeutral,
          btnText: styles.btnNeutralText,
          icon: <Info size={18} color={tokens.colors.inkSecondary} />,
        };
      case 'info':
      default:
        return {
          container: styles.bannerInfo,
          title: styles.textInfo,
          message: styles.textInfoSub,
          button: styles.btnInfo,
          btnText: styles.btnInfoText,
          icon: <AlertCircle size={18} color={tokens.colors.brandJade} />,
        };
    }
  };

  const currentKind = getKindStyle();

  return (
    <View style={[styles.container, currentKind.container, style]}>
      <View style={styles.contentRow}>
        <View style={styles.iconBox}>{currentKind.icon}</View>

        <View style={styles.textBox}>
          {title ? <Text style={[styles.title, currentKind.title]}>{title}</Text> : null}
          <Text style={[styles.message, currentKind.message]}>{message}</Text>
        </View>

        {onClose ? (
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Đóng thông báo"
          >
            <X size={16} color={tokens.colors.inkSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[styles.actionBtn, currentKind.button]}
          onPress={onAction}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.actionBtnText, currentKind.btnText]}>{actionLabel}</Text>
          <ChevronRight size={16} color={currentKind.btnText.color} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: tokens.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconBox: {
    marginTop: 2,
  },
  textBox: {
    flex: 1,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeBtn: {
    padding: 2,
  },
  actionBtn: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 40,
  },
  actionBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },

  // Danger (Đỏ)
  bannerDanger: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderColor: tokens.colors.alertCrimson,
  },
  textDanger: {
    color: tokens.colors.alertCrimson,
  },
  textDangerSub: {
    color: '#7F1D1D',
  },
  btnDanger: {
    backgroundColor: tokens.colors.alertCrimson,
  },
  btnDangerText: {
    color: '#FFFFFF',
  },

  // Info (Xanh Jade)
  bannerInfo: {
    backgroundColor: tokens.colors.brandJadeSoft,
    borderColor: tokens.colors.brandJade,
  },
  textInfo: {
    color: tokens.colors.brandJadeDark,
  },
  textInfoSub: {
    color: tokens.colors.inkPrimary,
  },
  btnInfo: {
    backgroundColor: tokens.colors.brandJade,
  },
  btnInfoText: {
    color: '#FFFFFF',
  },

  // Warning (Vàng / Cam)
  bannerWarning: {
    backgroundColor: tokens.colors.accentOchreSoft,
    borderColor: tokens.colors.accentOchre,
  },
  textWarning: {
    color: '#92400E',
  },
  textWarningSub: {
    color: '#78350F',
  },
  btnWarning: {
    backgroundColor: tokens.colors.accentOchre,
  },
  btnWarningText: {
    color: '#FFFFFF',
  },

  // Neutral (Xám)
  bannerNeutral: {
    backgroundColor: tokens.colors.subtle,
    borderColor: tokens.colors.borderHairline,
  },
  textNeutral: {
    color: tokens.colors.inkPrimary,
  },
  textNeutralSub: {
    color: tokens.colors.inkSecondary,
  },
  btnNeutral: {
    backgroundColor: tokens.colors.paper,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  btnNeutralText: {
    color: tokens.colors.inkPrimary,
  },
});
