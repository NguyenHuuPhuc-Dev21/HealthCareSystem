import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AlertTriangle,
  ArrowLeft,
  Lock,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react-native';
import type {
  PendingReviewDto,
  ReceivedReviewDto,
  SentReviewDto,
  TrustScoreDto,
} from '@healthcare-system/shared';
import { StateView } from '../../components/StateView';
import { env } from '../../lib/env';
import { formatDateTime } from '../../lib/formatters';
import type { ActiveStackParamList } from '../../navigation/types';
import { tokens } from '../../styles/tokens';
import { RateCustomerSheet } from '../reviews/components/RateCustomerSheet';
import { SentReviewList } from '../reviews/components/SentReviewList';
import { getPendingReviews, getSentReviews } from '../reviews/reviews.api';
import { ScoreHistoryList } from './components/ScoreHistoryList';
import { ScoreRing } from './components/ScoreRing';
import { ScoreRulesCard } from './components/ScoreRulesCard';
import {
  getReceivedReviews,
  getTrustScore,
  mockSetScoreForTesting,
} from './trust-score.api';
import {
  getScoreTierMeta,
  TRUST_SCORE_SUSPEND_THRESHOLD,
  TRUST_SCORE_WARNING_THRESHOLD,
} from './trust-score-labels';

type TrustScoreNavProp = NativeStackNavigationProp<
  ActiveStackParamList,
  'TrustScore'
>;

interface TrustScoreScreenProps {
  navigation: TrustScoreNavProp;
}

type TrustScoreTab = 'my-score' | 'sent-reviews';

function renderStarsText(rating: number): string {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(clamped)}${'☆'.repeat(5 - clamped)}`;
}

export const TrustScoreScreen: React.FC<TrustScoreScreenProps> = ({
  navigation,
}) => {
  const [activeTab, setActiveTab] = useState<TrustScoreTab>('my-score');
  const [trustScoreData, setTrustScoreData] = useState<TrustScoreDto | null>(null);
  const [reviews, setReviews] = useState<ReceivedReviewDto[]>([]);
  const [sentReviews, setSentReviews] = useState<SentReviewDto[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReviewDto[]>([]);
  const [ratingTarget, setRatingTarget] = useState<PendingReviewDto | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [tsRes, revRes, sentRes, pendingRes] = await Promise.all([
        getTrustScore(),
        getReceivedReviews(),
        getSentReviews(),
        getPendingReviews(),
      ]);

      if (tsRes.success && tsRes.data) {
        setTrustScoreData(tsRes.data);
      } else {
        setError(tsRes.error?.message || 'Không thể tải điểm TrustScore.');
      }

      if (revRes.success && revRes.data) {
        setReviews(revRes.data);
      }

      if (sentRes.success && sentRes.data) {
        setSentReviews(sentRes.data);
      }

      if (pendingRes.success && pendingRes.data) {
        setPendingReviews(pendingRes.data);
      }
    } catch {
      setError('Lỗi kết nối khi tải dữ liệu TrustScore.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const score = trustScoreData?.score ?? 0;
  const isSuspended =
    trustScoreData !== null && score < TRUST_SCORE_SUSPEND_THRESHOLD;
  const isWarning =
    trustScoreData !== null &&
    score >= TRUST_SCORE_SUSPEND_THRESHOLD &&
    score < TRUST_SCORE_WARNING_THRESHOLD;
  const tierMeta = getScoreTierMeta(score);

  const distribution = trustScoreData?.ratingDistribution ?? {
    star5: 0,
    star4: 0,
    star3: 0,
    star2: 0,
    star1: 0,
  };

  const handleTestScore = (targetScore: number) => {
    mockSetScoreForTesting(targetScore);
    void loadData();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={22} color={tokens.colors.inkPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextBox}>
          <Text style={styles.headerTitle}>Đánh giá &amp; TrustScore</Text>
          <Text style={styles.headerSub}>
            Minh bạch từng lần cộng trừ điểm uy tín
          </Text>
        </View>
      </View>

      {/* Top 2 Tabs */}
      <View style={styles.tabBar} accessibilityRole="tablist">
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'my-score' && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab('my-score')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'my-score' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'my-score' && styles.tabTextActive,
            ]}
          >
            Điểm của tôi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'sent-reviews' && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab('sent-reviews')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'sent-reviews' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'sent-reviews' && styles.tabTextActive,
            ]}
          >
            Đánh giá tôi đã gửi
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'sent-reviews' ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadData(true)}
              colors={[tokens.colors.brandJade]}
            />
          }
        >
          {toastMessage ? (
            <View style={styles.toastBox} accessibilityRole="alert">
              <CheckCircle2 size={20} color={tokens.colors.brandJade} />
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          ) : null}
          {loading ? (
            <StateView
              kind="loading"
              title="Đang tải đánh giá đã gửi..."
              message="Vui lòng chờ trong giây lát."
            />
          ) : (
            <SentReviewList
              reviews={sentReviews}
              pendingReviews={pendingReviews}
              onOpenRateSheet={(pending) => setRatingTarget(pending)}
            />
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadData(true)}
              colors={[tokens.colors.brandJade]}
            />
          }
        >
          {loading ? (
            <StateView
              kind="loading"
              title="Đang tải điểm TrustScore..."
              message="Vui lòng chờ trong giây lát."
            />
          ) : error ? (
            <StateView
              kind="error"
              title="Không thể tải TrustScore"
              message={error}
              actionLabel="Thử lại"
              onAction={() => void loadData()}
            />
          ) : (
            <>
              {/* Suspended Banner (< 60) */}
              {isSuspended ? (
                <View style={styles.suspendedBanner} accessibilityRole="alert">
                  <ShieldAlert
                    size={24}
                    color={tokens.colors.alertCrimson}
                    style={styles.bannerIcon}
                  />
                  <View style={styles.bannerBody}>
                    <Text style={styles.suspendedTitle}>
                      Tài khoản đang tạm khóa nhận ca
                    </Text>
                    <Text style={styles.suspendedMsg}>
                      Điểm TrustScore hiện tại là {score} / 100 (dưới ngưỡng{' '}
                      {TRUST_SCORE_SUSPEND_THRESHOLD} điểm). Bạn tạm thời không thể nhận ca mới từ Radar hoặc Job Board. Vui lòng liên hệ Admin để được hỗ trợ.
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Warning Banner (60 - 69) */}
              {isWarning ? (
                <View style={styles.warningBanner} accessibilityRole="alert">
                  <AlertTriangle
                    size={24}
                    color={tokens.colors.accentOchre}
                    style={styles.bannerIcon}
                  />
                  <View style={styles.bannerBody}>
                    <Text style={styles.warningTitle}>
                      Cảnh báo: Điểm sắp chạm ngưỡng {TRUST_SCORE_SUSPEND_THRESHOLD}
                    </Text>
                    <Text style={styles.warningMsg}>
                      Điểm hiện tại là {score} / 100. Khi dưới{' '}
                      {TRUST_SCORE_SUSPEND_THRESHOLD} điểm, hệ thống sẽ tạm khóa quyền nhận ca. Hãy hoàn thành tốt các ca sắp tới (+2 điểm mỗi ca được đánh giá ≥ 4★).
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Score Ring Card */}
              <View style={styles.scoreCard}>
                <ScoreRing score={score} />
                <Text style={styles.scoreHeading}>
                  TrustScore · {score} / 100
                </Text>
                <View
                  style={[
                    styles.tierBadge,
                    { backgroundColor: tierMeta.softColor },
                  ]}
                >
                  <Text style={[styles.tierBadgeText, { color: tierMeta.color }]}>
                    {tierMeta.label}
                  </Text>
                </View>
                <Text style={styles.scoreSummary}>{tierMeta.summary}</Text>

                {typeof __DEV__ !== 'undefined' && __DEV__ && env.useMockTrustScore ? (
                  <View style={styles.devBar}>
                    <Text style={styles.devLabel}>[DEV] Thử ngưỡng điểm:</Text>
                    <View style={styles.devBtnRow}>
                      {[92, 65, 55].map((preset) => (
                        <TouchableOpacity
                          key={preset}
                          style={[
                            styles.devBtn,
                            score === preset && styles.devBtnActive,
                          ]}
                          onPress={() => handleTestScore(preset)}
                          accessibilityRole="button"
                        >
                          <Text
                            style={[
                              styles.devBtnText,
                              score === preset && styles.devBtnTextActive,
                            ]}
                          >
                            {preset}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Rules Card */}
              <ScoreRulesCard />

              {/* History List (FlatList) */}
              <ScoreHistoryList history={trustScoreData?.history ?? []} />

              {/* Received Reviews Card */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Đánh giá khách dành cho bạn</Text>

                {/* Aggregate Rating */}
                <View style={styles.ratingSummaryRow}>
                  <View style={styles.ratingAvgBox}>
                    <Text style={styles.ratingAvgValue}>
                      {trustScoreData?.ratingAvg !== null &&
                        trustScoreData?.ratingAvg !== undefined
                        ? trustScoreData.ratingAvg.toFixed(1)
                        : '—'}
                    </Text>
                    <Text style={styles.starsLarge}>★★★★★</Text>
                    <Text style={styles.ratingCount}>
                      {trustScoreData?.ratingCount ?? 0} lượt đánh giá
                    </Text>
                  </View>

                  <View style={styles.distCol}>
                    {[
                      { label: '5★', pct: distribution.star5 },
                      { label: '4★', pct: distribution.star4 },
                      { label: '3★', pct: distribution.star3 },
                      { label: '2★', pct: distribution.star2 },
                      { label: '1★', pct: distribution.star1 },
                    ].map((row) => (
                      <View key={row.label} style={styles.distRow}>
                        <Text style={styles.distLabel}>{row.label}</Text>
                        <View style={styles.distTrack}>
                          <View
                            style={[
                              styles.distFill,
                              { width: `${Math.max(0, Math.min(100, row.pct))}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.distPct}>{row.pct}%</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Individual Reviews */}
                {reviews.length === 0 ? (
                  <Text style={styles.emptyReviews}>
                    Chưa có đánh giá nào từ khách hàng.
                  </Text>
                ) : (
                  reviews.map((review, index) => (
                    <View
                      key={review.id}
                      style={[
                        styles.reviewItem,
                        index === reviews.length - 1 && styles.reviewItemLast,
                      ]}
                    >
                      <View style={styles.reviewHead}>
                        <Text style={styles.reviewCustomer}>
                          {review.customerName || 'Khách hàng CareNest'}
                        </Text>
                        <Text style={styles.reviewCode}>{review.bookingCode}</Text>
                      </View>
                      <Text style={styles.reviewDate}>
                        {formatDateTime(review.createdAt)}
                      </Text>

                      {!review.isVisible ? (
                        <View style={styles.blindBox}>
                          <Lock size={16} color={tokens.colors.inkMuted} />
                          <Text style={styles.blindText}>
                            Đánh giá đang được ẩn — hiển thị khi hai bên cùng đánh giá hoặc đủ 7 ngày.
                          </Text>
                        </View>
                      ) : (
                        <>
                          <Text
                            style={styles.reviewStars}
                            accessibilityLabel={`${review.rating} trên 5 sao`}
                          >
                            {renderStarsText(review.rating)}
                          </Text>
                          {review.comment ? (
                            <Text style={styles.reviewComment}>
                              {review.comment}
                            </Text>
                          ) : null}
                        </>
                      )}
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {ratingTarget ? (
        <RateCustomerSheet
          visible={ratingTarget !== null}
          bookingId={ratingTarget.bookingId}
          bookingCode={ratingTarget.bookingCode}
          customerName={ratingTarget.customerName}
          onClose={() => setRatingTarget(null)}
          onSuccess={(message) => {
            setRatingTarget(null);
            setToastMessage(message);
            void loadData(true);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  backBtn: {
    width: tokens.spacing.touchTargetMin,
    height: tokens.spacing.touchTargetMin,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  headerSub: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.paper,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 6,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  tabBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  tabBtnActive: {
    backgroundColor: tokens.colors.brandJade,
  },
  tabText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  suspendedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderWidth: 1.5,
    borderColor: tokens.colors.alertCrimson,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.accentOchreSoft,
    borderWidth: 1.5,
    borderColor: tokens.colors.accentOchre,
  },
  bannerIcon: {
    marginTop: 2,
  },
  bannerBody: {
    flex: 1,
  },
  suspendedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.alertCrimson,
    marginBottom: 4,
  },
  suspendedMsg: {
    fontSize: 14.5,
    color: tokens.colors.inkPrimary,
    lineHeight: 21,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.accentOchre,
    marginBottom: 4,
  },
  warningMsg: {
    fontSize: 14.5,
    color: tokens.colors.inkPrimary,
    lineHeight: 21,
  },
  scoreCard: {
    backgroundColor: tokens.colors.paper,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    padding: 20,
    alignItems: 'center',
  },
  scoreHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    marginTop: 12,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
    marginTop: 6,
  },
  tierBadgeText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  scoreSummary: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  devBar: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderHairline,
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 8,
  },
  devLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.inkMuted,
  },
  devBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  devBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.subtle,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  devBtnActive: {
    backgroundColor: tokens.colors.brandJade,
    borderColor: tokens.colors.brandJade,
  },
  devBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  devBtnTextActive: {
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
    marginBottom: 12,
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 14,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  ratingAvgBox: {
    alignItems: 'center',
    minWidth: 96,
  },
  ratingAvgValue: {
    fontSize: 36,
    fontWeight: '900',
    color: tokens.colors.inkPrimary,
    lineHeight: 40,
    fontVariant: ['tabular-nums'],
  },
  starsLarge: {
    fontSize: 16,
    color: '#D97706',
    marginTop: 2,
  },
  ratingCount: {
    fontSize: 13,
    color: tokens.colors.inkMuted,
    marginTop: 2,
  },
  distCol: {
    flex: 1,
    gap: 4,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distLabel: {
    width: 26,
    fontSize: 12.5,
    color: tokens.colors.inkSecondary,
    fontWeight: '600',
  },
  distTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: tokens.colors.subtle,
    overflow: 'hidden',
  },
  distFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#D97706',
  },
  distPct: {
    width: 34,
    textAlign: 'right',
    fontSize: 12,
    color: tokens.colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  reviewItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  reviewItemLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reviewCustomer: {
    fontSize: 15.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  reviewCode: {
    fontSize: 12.5,
    fontWeight: '600',
    color: tokens.colors.inkMuted,
  },
  reviewDate: {
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
    marginBottom: 6,
  },
  reviewStars: {
    fontSize: 16,
    color: '#D97706',
    marginBottom: 4,
  },
  reviewComment: {
    fontSize: 14.5,
    color: tokens.colors.inkPrimary,
    lineHeight: 21,
  },
  blindBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.colors.subtle,
    borderRadius: tokens.radii.sm,
    padding: 10,
  },
  blindText: {
    flex: 1,
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    lineHeight: 19,
  },
  emptyReviews: {
    fontSize: 14.5,
    color: tokens.colors.inkMuted,
    textAlign: 'center',
    paddingVertical: 16,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tokens.colors.brandJadeSoft,
    borderWidth: 1,
    borderColor: tokens.colors.brandJade,
    borderRadius: tokens.radii.md,
    padding: 14,
  },
  toastText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.brandJadeDark,
    lineHeight: 20,
  },
  placeholderBox: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 12,
    gap: 10,
  },
  placeholderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
    textAlign: 'center',
  },
  placeholderSub: {
    fontSize: 14.5,
    color: tokens.colors.inkSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
});
