import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Lock, Send } from 'lucide-react-native';
import { detectOffPlatformContact } from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';
import { CHAT_CONFIG, CHAT_LABELS } from '../chat-labels';

export interface ComposerProps {
  isOpen: boolean;
  closedReason?: string;
  onSend: (content: string) => Promise<boolean> | boolean | void;
}

export const Composer: React.FC<ComposerProps> = ({
  isOpen,
  closedReason,
  onSend,
}) => {
  const [text, setText] = useState('');

  if (!isOpen) {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.lockedHeader}>
          <Lock size={16} color={tokens.colors.inkSecondary} />
          <Text style={styles.lockedTitle}>{CHAT_LABELS.composerLockedTitle}</Text>
        </View>
        <Text style={styles.lockedReason}>
          {closedReason || CHAT_LABELS.composerLockedReason}
        </Text>
      </View>
    );
  }

  const trimmed = text.trim();
  const canSend = trimmed.length > 0;

  const commitSend = (content: string) => {
    setText('');
    void onSend(content);
  };

  const handlePressSend = () => {
    if (!canSend) return;

    const scan = detectOffPlatformContact(trimmed);
    if (scan.hasOffPlatformContact) {
      Alert.alert(
        CHAT_LABELS.offPlatformDialogTitle,
        CHAT_LABELS.offPlatformDialogMessage,
        [
          {
            text: CHAT_LABELS.offPlatformDialogCancel,
            style: 'cancel',
          },
          {
            text: CHAT_LABELS.offPlatformDialogConfirm,
            onPress: () => commitSend(trimmed),
          },
        ]
      );
      return;
    }

    commitSend(trimmed);
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={CHAT_LABELS.composerPlaceholder}
          placeholderTextColor={tokens.colors.inkMuted}
          multiline
          maxLength={CHAT_CONFIG.MAX_MESSAGE_LENGTH}
          textAlignVertical="center"
          accessibilityLabel={CHAT_LABELS.composerPlaceholder}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={handlePressSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={CHAT_LABELS.composerSendAccessibility}
        >
          <Send
            size={20}
            color={canSend ? tokens.colors.paper : tokens.colors.inkMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.paper,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: tokens.spacing.touchTargetMin,
    maxHeight: 120,
    backgroundColor: tokens.colors.canvas,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 22,
    color: tokens.colors.inkPrimary,
  },
  sendBtn: {
    minWidth: tokens.spacing.touchTargetMin,
    minHeight: tokens.spacing.touchTargetMin,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sendBtnDisabled: {
    backgroundColor: tokens.colors.subtle,
  },
  lockedContainer: {
    backgroundColor: tokens.colors.subtle,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  lockedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  lockedReason: {
    fontSize: 13.5,
    lineHeight: 19,
    color: tokens.colors.inkSecondary,
    textAlign: 'center',
  },
});
