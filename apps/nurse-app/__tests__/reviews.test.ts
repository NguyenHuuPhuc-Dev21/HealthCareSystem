import React from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import {
  REVIEW_BLIND_SUCCESS_MESSAGE,
  REVIEW_ERROR_MESSAGES,
  REVIEW_LOW_RATING_HINT,
} from '@healthcare-system/shared';
import {
  getPendingReviews,
  getSentReviews,
  mockSetReviewErrorForTesting,
  resetReviewsMockState,
  submitCustomerRating,
} from '../src/features/reviews/reviews.api';
import { StarRow } from '../src/features/reviews/components/StarRow';
import { RateCustomerSheet } from '../src/features/reviews/components/RateCustomerSheet';
import { SentReviewList } from '../src/features/reviews/components/SentReviewList';
import { tokens } from '../src/styles/tokens';

function collectText(node: renderer.ReactTestInstance): string {
  return node
    .findAllByType('Text' as any)
    .map((t) =>
      t.children
        .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
        .join('')
    )
    .join(' | ');
}

describe('A14 — Customer Review after Shift (nurse-app)', () => {
  beforeEach(() => {
    resetReviewsMockState();
    jest.restoreAllMocks();
  });

  describe('1. Reviews API & mock state', () => {
    it('loads pending and sent reviews from mock', async () => {
      const [pendingRes, sentRes] = await Promise.all([
        getPendingReviews(),
        getSentReviews(),
      ]);
      expect(pendingRes.success).toBe(true);
      expect(pendingRes.data.length).toBeGreaterThan(0);
      expect(sentRes.success).toBe(true);
      expect(sentRes.data.length).toBeGreaterThan(0);
    });

    it('submits rating, moves shift out of pending, and adds blind sent review', async () => {
      const pendingBefore = await getPendingReviews();
      const target = pendingBefore.data[0];

      const res = await submitCustomerRating(target.bookingId, {
        rating: 5,
        comment: 'Gia đình rất chu đáo',
        tags: ['Hợp tác tốt'],
      });
      expect(res.success).toBe(true);
      expect(res.data.review_id).toBeTruthy();

      const pendingAfter = await getPendingReviews();
      expect(pendingAfter.data.some((p) => p.bookingId === target.bookingId)).toBe(false);

      const sentAfter = await getSentReviews();
      const created = sentAfter.data.find((s) => s.bookingCode === target.bookingCode);
      expect(created).toBeDefined();
      expect(created?.isVisible).toBe(false);
      expect(created?.rating).toBe(5);
    });

    it('rejects duplicate submission with REVIEW_ALREADY_SUBMITTED', async () => {
      const pending = await getPendingReviews();
      const target = pending.data[0];

      await submitCustomerRating(target.bookingId, { rating: 4 });
      const dupRes = await submitCustomerRating(target.bookingId, { rating: 5 });

      expect(dupRes.success).toBe(false);
      expect(dupRes.error?.code).toBe('REVIEW_ALREADY_SUBMITTED');
    });
  });

  describe('2. StarRow accessibility & touch target', () => {
    it('renders 5 stars with >= 48dp touch target and Vietnamese TalkBack labels', () => {
      const onChange = jest.fn();
      const tree = renderer.create(
        React.createElement(StarRow, { value: 4, onChange })
      );

      const buttons = tree.root.findAll(
        (n) =>
          n.type === TouchableOpacity &&
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.includes('trên 5 sao')
      );
      expect(buttons).toHaveLength(5);
      expect(buttons[3].props.accessibilityLabel).toBe('4 trên 5 sao');
      expect(buttons[3].props.accessibilityState.selected).toBe(true);
      expect(buttons[3].props.style.minWidth).toBeGreaterThanOrEqual(
        tokens.spacing.touchTargetMin
      );
      expect(buttons[3].props.style.minHeight).toBeGreaterThanOrEqual(
        tokens.spacing.touchTargetMin
      );

      act(() => {
        buttons[4].props.onPress();
      });
      expect(onChange).toHaveBeenCalledWith(5);
    });
  });

  describe('3. RateCustomerSheet form state & submission', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
    });

    it('disables submit button until rating is chosen and shows low-rating hint for <= 2 stars', () => {
      let tree!: renderer.ReactTestRenderer;
      act(() => {
        tree = renderer.create(
          React.createElement(RateCustomerSheet, {
            visible: true,
            bookingId: 'shift-completed-1',
            bookingCode: 'HC-2026-1057',
            customerName: 'Bà Nguyễn Thị Hoa',
            onClose: jest.fn(),
            onSuccess: jest.fn(),
          })
        );
      });

      const getSubmitBtn = () =>
        tree.root.find((n) => n.props.label === 'Gửi' && n.props.variant === 'primary');

      // Initially disabled when rating === 0
      expect(getSubmitBtn().props.disabled).toBe(true);

      // Select 2 stars -> enabled + low-rating hint visible
      const star2 = tree.root.find(
        (n) =>
          n.type === TouchableOpacity &&
          n.props.accessibilityLabel === '2 trên 5 sao'
      );
      act(() => {
        star2.props.onPress();
      });

      expect(getSubmitBtn().props.disabled).toBe(false);
      expect(collectText(tree.root)).toContain(REVIEW_LOW_RATING_HINT);
    });

    it('submits payload and calls onSuccess with 7-day blind review message', async () => {
      const onSuccess = jest.fn();
      let tree!: renderer.ReactTestRenderer;
      act(() => {
        tree = renderer.create(
          React.createElement(RateCustomerSheet, {
            visible: true,
            bookingId: 'shift-completed-1',
            bookingCode: 'HC-2026-1057',
            customerName: 'Bà Nguyễn Thị Hoa',
            onClose: jest.fn(),
            onSuccess,
          })
        );
      });

      const star5 = tree.root.find(
        (n) =>
          n.type === TouchableOpacity &&
          n.props.accessibilityLabel === '5 trên 5 sao'
      );
      const input = tree.root.findByType('TextInput' as any);
      const tagBtn = tree.root.find(
        (n) =>
          n.type === TouchableOpacity &&
          n.props.accessibilityRole === 'button' &&
          collectText(n).includes('Hợp tác tốt')
      );

      act(() => {
        star5.props.onPress();
        input.props.onChangeText('Gia đình hợp tác rất tốt');
        tagBtn.props.onPress();
      });

      const submitBtn = tree.root.find(
        (n) => n.props.label === 'Gửi' && n.props.variant === 'primary'
      );

      await act(async () => {
        await submitBtn.props.onPress();
      });

      expect(onSuccess).toHaveBeenCalledWith(REVIEW_BLIND_SUCCESS_MESSAGE);
    });

    it('closes sheet and alerts when REVIEW_WINDOW_CLOSED is returned', async () => {
      mockSetReviewErrorForTesting('REVIEW_WINDOW_CLOSED');
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const onClose = jest.fn();

      let tree!: renderer.ReactTestRenderer;
      act(() => {
        tree = renderer.create(
          React.createElement(RateCustomerSheet, {
            visible: true,
            bookingId: 'shift-completed-1',
            bookingCode: 'HC-2026-1057',
            customerName: 'Bà Nguyễn Thị Hoa',
            onClose,
            onSuccess: jest.fn(),
          })
        );
      });

      const star4 = tree.root.find(
        (n) =>
          n.type === TouchableOpacity &&
          n.props.accessibilityLabel === '4 trên 5 sao'
      );
      act(() => {
        star4.props.onPress();
      });

      const submitBtn = tree.root.find(
        (n) => n.props.label === 'Gửi' && n.props.variant === 'primary'
      );

      await act(async () => {
        await submitBtn.props.onPress();
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Thông báo',
        REVIEW_ERROR_MESSAGES.REVIEW_WINDOW_CLOSED
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('4. SentReviewList rendering', () => {
    it('renders pending review CTA and sent reviews with visibility badges', async () => {
      const [pendingRes, sentRes] = await Promise.all([
        getPendingReviews(),
        getSentReviews(),
      ]);

      const onOpenRateSheet = jest.fn();
      const tree = renderer.create(
        React.createElement(SentReviewList, {
          reviews: sentRes.data,
          pendingReviews: pendingRes.data,
          onOpenRateSheet,
        })
      );

      const text = collectText(tree.root);
      expect(text).toContain('ca chờ bạn đánh giá');
      expect(text).toContain('Đã công khai');
      expect(text).toContain('Đang ẩn');
    });
  });
});
