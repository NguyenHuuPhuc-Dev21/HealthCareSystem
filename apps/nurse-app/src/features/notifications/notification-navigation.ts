import type { NotificationDto, NurseNotificationType } from '@healthcare-system/shared';

export interface NotificationRouteTarget {
  routeName: string;
  params?: Record<string, any>;
}

export interface NotificationNavigationInput {
  type?: NurseNotificationType | string;
  id?: string;
  data?: {
    bookingId?: string;
    bookingCode?: string;
    offerId?: string;
    disputeId?: string;
    transactionId?: string;
    conversationId?: string;
    commissionId?: string;
    withdrawalId?: string;
    notificationId?: string;
    shift?: any;
    [key: string]: any;
  };
}

/**
 * Maps NurseNotificationType -> target React Navigation screen & params (A17 / W09).
 * Falls back to 'Notifications' if a target screen or required identifier is missing.
 */
export function resolveNotificationTarget(
  input: NotificationNavigationInput
): NotificationRouteTarget {
  const { type, data, id } = input;

  switch (type) {
    case 'RADAR_URGENT': {
      const offerId = data?.offerId || data?.bookingId;
      if (offerId) {
        return {
          routeName: 'Radar',
          params: {
            offerId: String(offerId),
            notificationId: data?.notificationId || id,
          },
        };
      }
      return { routeName: 'Notifications' };
    }

    case 'DIRECT_INVITE':
    case 'NEW_JOB':
      return {
        routeName: 'MainTabs',
        params: { screen: 'JobsTab' },
      };

    case 'EXTENSION_REQUEST':
      if (data?.shift) {
        return {
          routeName: 'ActiveShift',
          params: { shift: data.shift },
        };
      }
      return {
        routeName: 'MainTabs',
        params: { screen: 'ShiftsTab' },
      };

    case 'BOOKING_CANCELLED':
    case 'SHIFT_REMINDER':
      return {
        routeName: 'MainTabs',
        params: { screen: 'ShiftsTab' },
      };

    case 'DISPUTE_OPENED':
    case 'DISPUTE_RESOLVED':
      if (data?.disputeId) {
        return {
          routeName: 'DisputeDetail',
          params: { disputeId: String(data.disputeId) },
        };
      }
      return { routeName: 'DisputeList' };

    case 'COMMISSION_DUE':
    case 'COMMISSION_OVERDUE':
      return {
        routeName: 'CommissionPayment',
        params: data?.bookingId ? { bookingId: String(data.bookingId) } : undefined,
      };

    case 'DEPOSIT_LOW':
    case 'DEPOSIT_WITHHELD':
      return { routeName: 'Deposit' };

    case 'DEPOSIT_PENALTY':
    case 'PENALTY_REVERSED':
      if (data?.transactionId) {
        return {
          routeName: 'PenaltyDetail',
          params: { transactionId: String(data.transactionId) },
        };
      }
      return { routeName: 'Deposit' };

    case 'DEPOSIT_REFUND_STATUS':
      return { routeName: 'AccountClosure' };

    case 'SETTLEMENT_DONE':
    case 'WITHDRAWAL_UPDATE':
      return {
        routeName: 'MainTabs',
        params: { screen: 'WalletTab' },
      };

    case 'NEW_MESSAGE':
      if (data?.bookingId) {
        return {
          routeName: 'Chat',
          params: {
            bookingId: String(data.bookingId),
            bookingCode: data.bookingCode ? String(data.bookingCode) : undefined,
          },
        };
      }
      return { routeName: 'Notifications' };

    case 'GPHN_EXPIRING':
    case 'CREDENTIAL_REVIEWED':
      return { routeName: 'Credentials' };

    case 'REVIEW_RECEIVED':
      return { routeName: 'TrustScore' };

    default:
      return { routeName: 'Notifications' };
  }
}

export function navigateFromNotification(
  input: NotificationNavigationInput | NotificationDto,
  navigate: (routeName: string, params?: any) => void
): NotificationRouteTarget {
  const target = resolveNotificationTarget(input);
  navigate(target.routeName, target.params);
  return target;
}
