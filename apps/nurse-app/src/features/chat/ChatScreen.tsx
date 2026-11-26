import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { setActiveChatTarget } from '../../lib/push';
import type { ActiveStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import { CHAT_LABELS } from './chat-labels';
import { Composer } from './components/Composer';
import { MessageBubble } from './components/MessageBubble';
import { useConversation, type OptimisticChatMessage } from './useConversation';

type ChatNavProps = Partial<NativeStackScreenProps<ActiveStackParamList, 'Chat'>>;

export interface ChatScreenProps extends ChatNavProps {
  bookingId?: string;
  bookingCode?: string;
  onBack?: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  route,
  navigation,
  bookingId: propBookingId,
  bookingCode: propBookingCode,
  onBack,
}) => {
  const bookingId = route?.params?.bookingId || propBookingId || '';
  const bookingCode = route?.params?.bookingCode || propBookingCode;

  const {
    conversation,
    invertedMessages,
    loading,
    error,
    send,
    retry,
    reload,
  } = useConversation(bookingId, true);

  // Suppress NEW_MESSAGE push notifications while viewing this exact conversation
  useEffect(() => {
    if (!bookingId && !conversation?.id) return;
    setActiveChatTarget({
      bookingId: bookingId || undefined,
      conversationId: conversation?.id,
    });
    return () => {
      setActiveChatTarget(null);
    };
  }, [bookingId, conversation?.id]);

  const handleGoBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigation?.goBack();
  };

  const counterpartName =
    conversation?.counterpartName || CHAT_LABELS.screenTitleFallback;
  const counterpartPhone =
    conversation?.counterpartPhoneMasked || CHAT_LABELS.maskedPhoneFallback;
  const isOpen = conversation?.isOpen ?? false;
  const displayBookingCode = conversation?.bookingCode || bookingCode;

  const renderMessage = ({ item }: { item: OptimisticChatMessage }) => (
    <MessageBubble message={item} onRetry={retry} />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 12}
      >
        {/* Header: Back + Counterpart Name + Masked Phone (No direct call button) */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleGoBack}
            accessibilityRole="button"
            accessibilityLabel={CHAT_LABELS.backAccessibility}
          >
            <ArrowLeft size={22} color={tokens.colors.inkPrimary} />
          </TouchableOpacity>

          <View style={styles.headerMeta}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {counterpartName}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  isOpen ? styles.statusBadgeOpen : styles.statusBadgeClosed,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    isOpen ? styles.statusTextOpen : styles.statusTextClosed,
                  ]}
                >
                  {isOpen ? CHAT_LABELS.statusOpen : CHAT_LABELS.statusClosed}
                </Text>
              </View>
            </View>
            <Text style={styles.headerSub} numberOfLines={1}>
              {displayBookingCode ? `${displayBookingCode} · ` : ''}
              {counterpartPhone}
            </Text>
          </View>
        </View>

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <ShieldCheck
            size={16}
            color={tokens.colors.brandJadeDark}
            style={styles.securityIcon}
          />
          <Text style={styles.securityText}>
            <Text style={styles.securityTitle}>{CHAT_LABELS.securityNoticeTitle} </Text>
            {CHAT_LABELS.securityNoticeBody}
          </Text>
        </View>

        {/* Messages List (Inverted FlatList) */}
        <View style={styles.listWrap}>
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={tokens.colors.brandJade} />
              <Text style={styles.centerText}>{CHAT_LABELS.loadingHistory}</Text>
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.reloadBtn} onPress={() => void reload()}>
                <Text style={styles.reloadBtnText}>{CHAT_LABELS.retryButton}</Text>
              </TouchableOpacity>
            </View>
          ) : invertedMessages.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.centerText}>{CHAT_LABELS.emptyHistory}</Text>
            </View>
          ) : (
            <FlatList
              data={invertedMessages}
              inverted
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        {/* Composer */}
        <Composer isOpen={isOpen} onSend={send} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.paper,
  },
  flex: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  backBtn: {
    width: tokens.spacing.touchTargetMin,
    height: tokens.spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.sm,
  },
  headerMeta: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  headerSub: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.pill,
  },
  statusBadgeOpen: {
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  statusBadgeClosed: {
    backgroundColor: tokens.colors.subtle,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextOpen: {
    color: tokens.colors.brandJadeDark,
  },
  statusTextClosed: {
    color: tokens.colors.inkMuted,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: tokens.colors.brandJadeSoft,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  securityIcon: {
    marginTop: 2,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: tokens.colors.inkPrimary,
  },
  securityTitle: {
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 12,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  centerText: {
    fontSize: 15,
    color: tokens.colors.inkSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: tokens.colors.alertCrimson,
    textAlign: 'center',
    fontWeight: '600',
  },
  reloadBtn: {
    minHeight: tokens.spacing.touchTargetMin,
    paddingHorizontal: 20,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.brandJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reloadBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.paper,
  },
});
