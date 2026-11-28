import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertTriangle, Check, Lock, X } from 'lucide-react-native';
import {
  REVIEW_BLIND_SUCCESS_MESSAGE,
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_ERROR_MESSAGES,
  REVIEW_LOW_RATING_HINT,
  REVIEW_LOW_RATING_THRESHOLD,
  REVIEW_QUICK_TAGS,
  type CreateReviewInput,
} from '@healthcare-system/shared';
import { AppButton } from '../../../components/AppButton';
import { tokens } from '../../../styles/tokens';
import { submitCustomerRating } from '../reviews.api';
import { StarRow } from './StarRow';

export interface RateCustomerSheetProps {
  visible: boolean;
  bookingId: string;
  bookingCode: string;
  customerName: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onOpenDispute?: () => void;
}

export const RateCustomerSheet: React.FC<RateCustomerSheetProps> = ({
  visible,
  bookingId,
  bookingCode,
  customerName,
  onClose,
  onSuccess,
  onOpenDispute,
}) => {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setRating(0);
      setComment('');
      setSelectedTags([]);
      setErrorMessage(null);
      setSubmitting(false);
    }
  }, [visible, bookingId]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) {
      setErrorMessage('Vui lòng chọn số sao đánh giá (từ 1 đến 5 sao).');
      return;
    }

    if (comment.length > REVIEW_COMMENT_MAX_LENGTH) {
      setErrorMessage(
        `Nhận xét không được vượt quá ${REVIEW_COMMENT_MAX_LENGTH} ký tự.`
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const input: CreateReviewInput = {
      rating: rating as 1 | 2 | 3 | 4 | 5,
      comment: comment.trim() || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    };

    try {
      const res = await submitCustomerRating(bookingId, input);
      if (res.success) {
        onSuccess(REVIEW_BLIND_SUCCESS_MESSAGE);
        return;
      }

      const code = res.error?.code;
      if (code === 'REVIEW_ALREADY_SUBMITTED' || code === 'REVIEW_WINDOW_CLOSED') {
        const msg =
          REVIEW_ERROR_MESSAGES[code] ||
          res.error?.message ||
          'Không thể gửi đánh giá.';
        Alert.alert('Thông báo', msg);
        onClose();
        return;
      }

      setErrorMessage(
        res.error?.message || 'Không thể gửi đánh giá. Vui lòng thử lại.'
      );
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ. Vui lòng thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  const isLowRating = rating > 0 && rating <= REVIEW_LOW_RATING_THRESHOLD;
  const canSubmit = rating >= 1 && rating <= 5 && !submitting;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerTextBox}>
              <Text style={styles.sheetTitle}>Đánh giá khách hàng sau ca</Text>
              <Text style={styles.sheetSub}>
                {customerName} · Mã ca {bookingCode}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Đóng biểu mẫu đánh giá"
            >
              <X size={20} color={tokens.colors.inkSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {errorMessage ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Star Selection */}
            <Text style={styles.fieldLabel}>Mức độ hài lòng của bạn *</Text>
            <StarRow value={rating} onChange={setRating} disabled={submitting} />

            {/* Low rating guidance (<= 2 stars) -> A15 */}
            {isLowRating ? (
              <View style={styles.lowRatingBox}>
                <AlertTriangle
                  size={20}
                  color={tokens.colors.alertCrimson}
                  style={styles.lowRatingIcon}
                />
                <View style={styles.lowRatingBody}>
                  <Text style={styles.lowRatingText}>
                    {REVIEW_LOW_RATING_HINT}
                  </Text>
                  {onOpenDispute ? (
                    <TouchableOpacity
                      onPress={onOpenDispute}
                      style={styles.disputeLink}
                      accessibilityRole="button"
                    >
                      <Text style={styles.disputeLinkText}>
                        Mở khiếu nại ca này →
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Quick Tags */}
            <Text style={styles.fieldLabel}>Nhãn nhanh (tùy chọn)</Text>
            <View style={styles.tagsWrap}>
              {REVIEW_QUICK_TAGS.map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagChip, selected && styles.tagChipSelected]}
                    onPress={() => toggleTag(tag)}
                    disabled={submitting}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    {selected ? (
                      <Check size={14} color="#FFFFFF" />
                    ) : null}
                    <Text
                      style={[
                        styles.tagText,
                        selected && styles.tagTextSelected,
                      ]}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Comment Input + Counter */}
            <View style={styles.commentHeader}>
              <Text style={styles.fieldLabel}>Nhận xét thêm</Text>
              <Text style={styles.charCounter}>
                {comment.length}/{REVIEW_COMMENT_MAX_LENGTH}
              </Text>
            </View>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Chia sẻ trải nghiệm làm việc với gia đình người bệnh..."
              placeholderTextColor={tokens.colors.inkMuted}
              multiline
              maxLength={REVIEW_COMMENT_MAX_LENGTH}
              editable={!submitting}
              textAlignVertical="top"
              accessibilityLabel="Nhận xét thêm về khách hàng"
            />

            {/* Blind review note */}
            <View style={styles.blindNotice}>
              <Lock size={15} color={tokens.colors.inkMuted} />
              <Text style={styles.blindNoticeText}>
                {REVIEW_BLIND_SUCCESS_MESSAGE}.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <View style={styles.actionFlex}>
                <AppButton
                  label="Để sau"
                  variant="secondary"
                  onPress={onClose}
                  disabled={submitting}
                />
              </View>
              <View style={styles.actionFlex}>
                <AppButton
                  label="Gửi"
                  variant="primary"
                  onPress={() => void handleSubmit()}
                  disabled={!canSubmit}
                  loading={submitting}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16, 42, 36, 0.45)',
  },
  backdropTap: {
    flex: 1,
  },
  sheet: {
    backgroundColor: tokens.colors.paper,
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    maxHeight: '88%',
    paddingTop: 16,
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  headerTextBox: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
  },
  sheetSub: {
    fontSize: 14,
    color: tokens.colors.inkSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },
  errorBox: {
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderWidth: 1,
    borderColor: tokens.colors.alertCrimson,
    borderRadius: tokens.radii.sm,
    padding: 10,
  },
  errorText: {
    fontSize: 14,
    color: tokens.colors.alertCrimson,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  lowRatingBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: tokens.colors.alertCrimsonSoft,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: tokens.radii.sm,
    padding: 12,
  },
  lowRatingIcon: {
    marginTop: 2,
  },
  lowRatingBody: {
    flex: 1,
    gap: 6,
  },
  lowRatingText: {
    fontSize: 13.5,
    color: tokens.colors.alertCrimson,
    lineHeight: 20,
    fontWeight: '600',
  },
  disputeLink: {
    alignSelf: 'flex-start',
  },
  disputeLinkText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: tokens.colors.alertCrimson,
    textDecorationLine: 'underline',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radii.pill,
    backgroundColor: tokens.colors.subtle,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  tagChipSelected: {
    backgroundColor: tokens.colors.brandJade,
    borderColor: tokens.colors.brandJade,
  },
  tagText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: tokens.colors.inkPrimary,
  },
  tagTextSelected: {
    color: '#FFFFFF',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  charCounter: {
    fontSize: 12.5,
    color: tokens.colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  commentInput: {
    minHeight: 92,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    backgroundColor: tokens.colors.canvas,
    padding: 12,
    fontSize: 15,
    color: tokens.colors.inkPrimary,
    lineHeight: 22,
  },
  blindNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.colors.subtle,
    borderRadius: tokens.radii.sm,
    padding: 10,
  },
  blindNoticeText: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.inkSecondary,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionFlex: {
    flex: 1,
  },
});
