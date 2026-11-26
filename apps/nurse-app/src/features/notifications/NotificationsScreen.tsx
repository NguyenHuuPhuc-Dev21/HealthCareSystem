import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react-native';
import {
  NotificationPriority,
  type NotificationDto,
} from '@healthcare-system/shared';
import { StateView } from '../../components/StateView';
import type { ActiveStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import { useNotifications } from './NotificationContext';
import {
  getNotificationCategoryLabel,
  NOTIFICATION_LABELS,
} from './notification-labels';
import { navigateFromNotification } from './notification-navigation';

export interface NotificationSection {
  title: string;
  data: NotificationDto[];
}

export function groupNotificationsByDay(
  notifications: NotificationDto[],
  nowMs: number = Date.now()
): NotificationSection[] {
  const now = new Date(nowMs);
  const startOfTodayMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  const today: NotificationDto[] = [];
  const earlier: NotificationDto[] = [];

  for (const item of notifications) {
    const createdMs = Date.parse(item.createdAt);
    if (!Number.isNaN(createdMs) && createdMs >= startOfTodayMs) {
      today.push(item);
    } else {
      earlier.push(item);
    }
  }

  const sections: NotificationSection[] = [];
  if (today.length > 0) {
    sections.push({ title: NOTIFICATION_LABELS.sectionToday, data: today });
  }
  if (earlier.length > 0) {
    sections.push({ title: NOTIFICATION_LABELS.sectionEarlier, data: earlier });
  }
  return sections;
}

function formatNotificationTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

type NotificationsNavProps = Partial<
  NativeStackScreenProps<ActiveStackParamList, 'Notifications'>
>;

export interface NotificationsScreenProps extends NotificationsNavProps {
  onBack?: () => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  navigation,
  onBack,
}) => {
  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const sections = useMemo(
    () => groupNotificationsByDay(notifications),
    [notifications]
  );

  const handleGoBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigation?.goBack();
  };

  const handlePressItem = (item: NotificationDto) => {
    void markAsRead(item.id);
    if (navigation) {
      navigateFromNotification(item, (routeName, params) => {
        (navigation as any).navigate(routeName, params);
      });
    }
  };

  const renderItem = ({ item }: { item: NotificationDto }) => {
    const isUnread = !item.readAt;
    const isHigh = item.priority === NotificationPriority.HIGH;
    const categoryLabel = getNotificationCategoryLabel(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.itemCard,
          isUnread && styles.itemCardUnread,
          isHigh && isUnread && styles.itemCardHigh,
        ]}
        onPress={() => handlePressItem(item)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <View style={styles.dotCol}>
          {isUnread ? <View style={styles.unreadDot} /> : <View style={styles.readSpacer} />}
        </View>

        <View style={styles.itemContent}>
          <View style={styles.itemTopRow}>
            <View
              style={[
                styles.categoryBadge,
                isHigh ? styles.categoryBadgeHigh : styles.categoryBadgeNormal,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  isHigh ? styles.categoryTextHigh : styles.categoryTextNormal,
                ]}
              >
                {categoryLabel}
              </Text>
            </View>
            <Text style={styles.timeText}>{formatNotificationTime(item.createdAt)}</Text>
          </View>

          <Text style={[styles.itemTitle, isUnread && styles.itemTitleUnread]}>
            {item.title}
          </Text>
          <Text style={styles.itemBody} numberOfLines={3}>
            {item.body}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleGoBack}
          accessibilityRole="button"
          accessibilityLabel={NOTIFICATION_LABELS.backAccessibility}
        >
          <ArrowLeft size={22} color={tokens.colors.inkPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Bell size={18} color={tokens.colors.brandJade} />
          <Text style={styles.headerTitle}>{NOTIFICATION_LABELS.screenTitle}</Text>
          {unreadCount > 0 ? (
            <View style={styles.headerCountBadge}>
              <Text style={styles.headerCountText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[
            styles.markAllBtn,
            unreadCount === 0 && styles.markAllBtnDisabled,
          ]}
          onPress={() => void markAllAsRead()}
          disabled={unreadCount === 0}
          accessibilityRole="button"
          accessibilityLabel={NOTIFICATION_LABELS.markAllRead}
        >
          <CheckCheck
            size={16}
            color={unreadCount > 0 ? tokens.colors.brandJadeDark : tokens.colors.inkMuted}
          />
          <Text
            style={[
              styles.markAllText,
              unreadCount === 0 && styles.markAllTextDisabled,
            ]}
          >
            {NOTIFICATION_LABELS.markAllRead}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      {loading && notifications.length === 0 ? (
        <View style={styles.centerWrap}>
          <StateView kind="loading" title={NOTIFICATION_LABELS.loadingTitle} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centerWrap}>
          <StateView
            kind="empty"
            title={NOTIFICATION_LABELS.emptyTitle}
            message={NOTIFICATION_LABELS.emptyMessage}
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              colors={[tokens.colors.brandJade]}
              tintColor={tokens.colors.brandJade}
            />
          }
          onEndReached={() => {
            if (hasMore) {
              void loadMore();
            }
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={tokens.colors.brandJade} />
                <Text style={styles.footerLoaderText}>
                  {NOTIFICATION_LABELS.loadMoreText}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  backBtn: {
    width: tokens.spacing.touchTargetMin,
    height: tokens.spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.sm,
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  headerCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: tokens.colors.alertCrimson,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.paper,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    minHeight: 36,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  markAllBtnDisabled: {
    backgroundColor: tokens.colors.subtle,
  },
  markAllText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
  },
  markAllTextDisabled: {
    color: tokens.colors.inkMuted,
  },
  centerWrap: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
    justifyContent: 'center',
    padding: 20,
  },
  listContent: {
    backgroundColor: tokens.colors.canvas,
    paddingBottom: 28,
    flexGrow: 1,
  },
  sectionHeader: {
    backgroundColor: tokens.colors.canvas,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.paper,
    marginHorizontal: 14,
    marginVertical: 5,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    padding: 14,
    gap: 10,
  },
  itemCardUnread: {
    backgroundColor: '#F8FCFA',
    borderColor: tokens.colors.brandJade,
  },
  itemCardHigh: {
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.accentOchre,
  },
  dotCol: {
    paddingTop: 6,
    width: 10,
    alignItems: 'center',
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: tokens.colors.brandJade,
  },
  readSpacer: {
    width: 9,
    height: 9,
  },
  itemContent: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.radii.pill,
  },
  categoryBadgeNormal: {
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  categoryBadgeHigh: {
    backgroundColor: tokens.colors.accentOchreSoft,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryTextNormal: {
    color: tokens.colors.brandJadeDark,
  },
  categoryTextHigh: {
    color: tokens.colors.accentOchre,
  },
  timeText: {
    fontSize: 12,
    color: tokens.colors.inkMuted,
  },
  itemTitle: {
    fontSize: 15.5,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
    marginBottom: 4,
    lineHeight: 21,
  },
  itemTitleUnread: {
    fontWeight: '700',
  },
  itemBody: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    lineHeight: 20,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
  },
});
