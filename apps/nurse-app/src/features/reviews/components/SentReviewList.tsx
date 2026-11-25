import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Clock, Eye, Lock, MessageSquare, Star } from 'lucide-react-native';
import type { PendingReviewDto, SentReviewDto } from '@healthcare-system/shared';
import { formatDateTime } from '../../../lib/formatters';
import { tokens } from '../../../styles/tokens';

export interface SentReviewListProps {
  reviews: SentReviewDto[];
  pendingReviews?: PendingReviewDto[];
  onOpenRateSheet?: (pending: PendingReviewDto) => void;
}

function renderStarsText(rating: number): string {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(clamped)}${'☆'.repeat(5 - clamped)}`;
}

export const SentReviewList: React.FC<SentReviewListProps> = ({
  reviews,
  pendingReviews = [],
  onOpenRateSheet,
}) => {
  const renderSentItem = ({
    item,
    index,
  }: {
    item: SentReviewDto;
    index: number;
  }) => (
    <View
      style={[
        styles.reviewCard,
        !item.isVisible && styles.reviewCardBlind,
        index === reviews.length - 1 && styles.reviewCardLast,
      ]}
    >
      <View style={styles.reviewHeader}>
        <View style={styles.reviewHeaderLeft}>
          <Text style={styles.customerName}>
            {item.customerName} · {item.bookingCode}
          </Text>
          <Text style={styles.dateText}>{formatDateTime(item.createdAt)}</Text>
        </View>
        <View
          style={[
            styles.visibilityPill,
            item.isVisible ? styles.pillPublic : styles.pillHidden,
          ]}
        >
          {item.isVisible ? (
            <Eye size={12} color={tokens.colors.brandJade} />
          ) : (
            <Lock size={12} color={tokens.colors.accentOchre} />
          )}
          <Text
            style={[
              styles.visibilityText,
              item.isVisible ? styles.textPublic : styles.textHidden,
            ]}
          >
            {item.isVisible ? 'Đã công khai' : 'Đang ẩn'}
          </Text>
        </View>
      </View>

      <Text
        style={styles.starsText}
        accessibilityLabel={`${item.rating} trên 5 sao`}
      >
        {renderStarsText(item.rating)}
      </Text>

      {item.tags && item.tags.length > 0 ? (
        <View style={styles.tagsRow}>
          {item.tags.map((tag) => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {item.comment ? (
        <Text style={styles.commentText}>{item.comment}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Pending Reviews Banner */}
      {pendingReviews.length > 0 ? (
        <View style={styles.pendingBox}>
          <View style={styles.pendingHeader}>
            <Clock size={18} color={tokens.colors.accentOchre} />
            <Text style={styles.pendingTitle}>
              {pendingReviews.length} ca chờ bạn đánh giá
            </Text>
          </View>
          {pendingReviews.map((pending) => (
            <View key={pending.bookingId} style={styles.pendingRow}>
              <View style={styles.pendingInfo}>
                <Text style={styles.pendingCustomer}>
                  {pending.customerName} · {pending.bookingCode}
                </Text>
                <Text style={styles.pendingDate}>
                  Hoàn tất: {formatDateTime(pending.completedAt)}
                </Text>
              </View>
              {onOpenRateSheet ? (
                <TouchableOpacity
                  style={styles.rateNowBtn}
                  onPress={() => onOpenRateSheet(pending)}
                  accessibilityRole="button"
                  accessibilityLabel={`Đánh giá ${pending.customerName}`}
                >
                  <Star size={14} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.rateNowText}>Đánh giá</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Sent Reviews Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Đánh giá bạn đã gửi ({reviews.length})
        </Text>
        {reviews.length === 0 ? (
          <View style={styles.emptyBox}>
            <MessageSquare size={32} color={tokens.colors.inkMuted} />
            <Text style={styles.emptyTitle}>Chưa có đánh giá nào đã gửi</Text>
            <Text style={styles.emptySub}>
              Sau khi hoàn tất ca trực, đánh giá bạn gửi cho khách hàng sẽ hiển thị tại đây.
            </Text>
          </View>
        ) : (
          <FlatList
            data={reviews}
            keyExtractor={(item) => item.id}
            renderItem={renderSentItem}
            scrollEnabled={false}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  pendingBox: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.accentOchre,
    padding: 14,
    gap: 10,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: tokens.colors.canvas,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    padding: 12,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingCustomer: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  pendingDate: {
    fontSize: 12.5,
    color: tokens.colors.inkMuted,
    marginTop: 2,
  },
  rateNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tokens.colors.brandJade,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radii.sm,
    minHeight: 40,
  },
  rateNowText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 17.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginBottom: 10,
  },
  reviewCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
    gap: 6,
  },
  reviewCardBlind: {
    backgroundColor: tokens.colors.canvas,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderBottomWidth: 0,
  },
  reviewCardLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  reviewHeaderLeft: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  dateText: {
    fontSize: 12.5,
    color: tokens.colors.inkMuted,
    marginTop: 2,
  },
  visibilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.pill,
  },
  pillPublic: {
    backgroundColor: tokens.colors.brandJadeSoft,
  },
  pillHidden: {
    backgroundColor: tokens.colors.accentOchreSoft,
  },
  visibilityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textPublic: {
    color: tokens.colors.brandJade,
  },
  textHidden: {
    color: tokens.colors.accentOchre,
  },
  starsText: {
    fontSize: 16,
    color: '#D97706',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    backgroundColor: tokens.colors.subtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.pill,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  commentText: {
    fontSize: 14.5,
    color: tokens.colors.inkPrimary,
    lineHeight: 20,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    marginTop: 4,
  },
  emptySub: {
    fontSize: 14,
    color: tokens.colors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
