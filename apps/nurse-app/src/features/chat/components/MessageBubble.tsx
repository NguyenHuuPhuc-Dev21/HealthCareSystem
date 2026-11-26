import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, Lock, RefreshCw } from 'lucide-react-native';
import { MessageType } from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';
import { CHAT_LABELS } from '../chat-labels';
import type { OptimisticChatMessage } from '../useConversation';

export interface MessageBubbleProps {
  message: OptimisticChatMessage;
  onRetry?: (messageId: string) => void;
}

function formatMessageTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onRetry,
}) => {
  const isSystem =
    message.senderRole === 'SYSTEM' ||
    message.type === MessageType.SYSTEM_ALERT;

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        <View style={styles.systemPill}>
          <Lock
            size={13}
            color={tokens.colors.inkSecondary}
            style={styles.systemIcon}
          />
          <Text style={styles.systemText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  const isMe = message.senderRole === 'NURSE';
  const timeText = formatMessageTime(message.createdAt);

  let deliveryLabel = '';
  if (isMe) {
    if (message.status === 'sending') {
      deliveryLabel = ` · ${CHAT_LABELS.statusSending}`;
    } else if (message.status === 'sent') {
      deliveryLabel = message.readAt
        ? ` · ${CHAT_LABELS.statusRead}`
        : ` · ${CHAT_LABELS.statusSent}`;
    }
  }

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
      <View
        style={[
          styles.bubble,
          isMe ? styles.bubbleMe : styles.bubbleThem,
          message.flagged ? styles.bubbleFlagged : null,
          message.status === 'error' ? styles.bubbleError : null,
        ]}
      >
        <Text style={[styles.content, isMe ? styles.contentMe : styles.contentThem]}>
          {message.content}
        </Text>

        {message.flagged ? (
          <View style={styles.flaggedBanner}>
            <AlertTriangle
              size={14}
              color={tokens.colors.accentOchre}
              style={styles.flaggedIcon}
            />
            <Text style={styles.flaggedText}>{CHAT_LABELS.flaggedWarning}</Text>
          </View>
        ) : null}

        <Text style={[styles.timeText, isMe ? styles.timeMe : styles.timeThem]}>
          {timeText}
          {deliveryLabel}
        </Text>
      </View>

      {isMe && message.status === 'error' ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorLabel}>
            {message.errorMessage || CHAT_LABELS.errorSendFailedLabel}
          </Text>
          {onRetry ? (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => onRetry(message.id)}
              accessibilityRole="button"
              accessibilityLabel={CHAT_LABELS.retryButton}
            >
              <RefreshCw size={14} color={tokens.colors.alertCrimson} />
              <Text style={styles.retryBtnText}>{CHAT_LABELS.retryButton}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  systemWrap: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  systemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.subtle,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '92%',
  },
  systemIcon: {
    marginRight: 6,
  },
  systemText: {
    flexShrink: 1,
    fontSize: 13.5,
    lineHeight: 19,
    color: tokens.colors.inkSecondary,
    textAlign: 'center',
  },
  row: {
    marginVertical: 5,
    paddingHorizontal: 14,
  },
  rowMe: {
    alignItems: 'flex-end',
  },
  rowThem: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: tokens.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    backgroundColor: tokens.colors.brandJade,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: tokens.colors.paper,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderBottomLeftRadius: 4,
  },
  bubbleFlagged: {
    borderWidth: 2,
    borderColor: tokens.colors.accentOchre,
  },
  bubbleError: {
    borderWidth: 1.5,
    borderColor: tokens.colors.alertCrimson,
  },
  content: {
    fontSize: 16,
    lineHeight: 23,
  },
  contentMe: {
    color: tokens.colors.paper,
  },
  contentThem: {
    color: tokens.colors.inkPrimary,
  },
  flaggedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: tokens.colors.accentOchreSoft,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 8,
  },
  flaggedIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  flaggedText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
    color: tokens.colors.accentOchre,
  },
  timeText: {
    fontSize: 12,
    marginTop: 5,
  },
  timeMe: {
    color: tokens.colors.brandJadeSoft,
    textAlign: 'right',
  },
  timeThem: {
    color: tokens.colors.inkMuted,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  errorLabel: {
    fontSize: 12.5,
    color: tokens.colors.alertCrimson,
    fontWeight: '600',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderWidth: 1,
    borderColor: tokens.colors.alertCrimson,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 34,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.alertCrimson,
  },
});
