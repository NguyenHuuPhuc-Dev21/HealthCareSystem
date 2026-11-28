import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  TRUST_SCORE_GOOD_THRESHOLD,
  TRUST_SCORE_SUSPEND_THRESHOLD,
  TRUST_SCORE_WARNING_THRESHOLD,
  type TrustScoreReason,
} from '@healthcare-system/shared';
import { tokens } from '../src/styles/tokens';
import {
  getScoreColor,
  getScoreTierMeta,
  getTrustScoreReasonLabel,
  getTrustScoreTier,
  TRUST_SCORE_RULES,
} from '../src/features/trust-score/trust-score-labels';
import {
  getReceivedReviews,
  getTrustScore,
  mockSetScoreForTesting,
  resetTrustScoreMockState,
} from '../src/features/trust-score/trust-score.api';
import { ScoreRing } from '../src/features/trust-score/components/ScoreRing';
import { ScoreHistoryList } from '../src/features/trust-score/components/ScoreHistoryList';
import { TrustScoreScreen } from '../src/features/trust-score/TrustScoreScreen';

function collectText(node: renderer.ReactTestInstance): string {
  const texts = node.findAllByType('Text' as any).map((t) =>
    t.children.map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : '')).join('')
  );
  return texts.join(' | ');
}

describe('A13 — TrustScore (nurse-app)', () => {
  beforeEach(() => {
    resetTrustScoreMockState();
  });

  describe('1. Score color & tier thresholds', () => {
    it('selects green (brandJade) for score >= TRUST_SCORE_GOOD_THRESHOLD (80)', () => {
      expect(getTrustScoreTier(92)).toBe('good');
      expect(getTrustScoreTier(TRUST_SCORE_GOOD_THRESHOLD)).toBe('good');
      expect(getScoreColor(92)).toBe(tokens.colors.brandJade);
    });

    it('selects yellow (accentOchre) for score in 70–79', () => {
      expect(getTrustScoreTier(TRUST_SCORE_WARNING_THRESHOLD)).toBe('fair');
      expect(getTrustScoreTier(75)).toBe('fair');
      expect(getScoreColor(75)).toBe(tokens.colors.accentOchre);
    });

    it('selects orange (#EA580C) warning tier for score in 60–69', () => {
      expect(getTrustScoreTier(TRUST_SCORE_SUSPEND_THRESHOLD)).toBe('warning');
      expect(getTrustScoreTier(65)).toBe('warning');
      expect(getScoreColor(65)).toBe('#EA580C');
      expect(getScoreTierMeta(65).label).toBe('Cảnh báo');
    });

    it('selects red (alertCrimson) suspended tier for score < 60', () => {
      expect(getTrustScoreTier(59)).toBe('suspended');
      expect(getTrustScoreTier(55)).toBe('suspended');
      expect(getScoreColor(55)).toBe(tokens.colors.alertCrimson);
      expect(getScoreTierMeta(55).label).toBe('Tạm khóa');
    });
  });

  describe('2. Vietnamese labels & rules', () => {
    it('returns Vietnamese labels for every TrustScoreReason', () => {
      const reasons: TrustScoreReason[] = [
        'GOOD_RATING_RECOVERY',
        'CANCEL_OVER_12H',
        'CANCEL_WITHIN_12H',
        'DISPUTE_UPHELD',
        'ADMIN_ADJUSTMENT',
      ];
      for (const reason of reasons) {
        const label = getTrustScoreReasonLabel(reason);
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(5);
        expect(label).not.toBe(reason);
      }
    });

    it('contains the 4 canonical score rules (+2, -5, -20, -25)', () => {
      const deltas = TRUST_SCORE_RULES.map((r) => r.delta);
      expect(deltas).toEqual([2, -5, -20, -25]);
    });
  });

  describe('3. TrustScore API & mock scenarios', () => {
    it('returns default 92 score and history', async () => {
      const res = await getTrustScore();
      expect(res.success).toBe(true);
      expect(res.data.score).toBe(92);
      expect(res.data.history.length).toBeGreaterThan(0);
    });

    it('supports mockSetScoreForTesting(65) and mockSetScoreForTesting(55)', async () => {
      mockSetScoreForTesting(65);
      const warnRes = await getTrustScore();
      expect(warnRes.data.score).toBe(65);

      mockSetScoreForTesting(55);
      const suspRes = await getTrustScore();
      expect(suspRes.data.score).toBe(55);
    });

    it('returns received reviews including a hidden blind review', async () => {
      const res = await getReceivedReviews();
      expect(res.success).toBe(true);
      expect(res.data.some((r) => r.isVisible === false)).toBe(true);
      expect(res.data.some((r) => r.isVisible === true)).toBe(true);
    });
  });

  describe('4. UI components & blind review privacy', () => {
    it('renders ScoreRing with clamped score', () => {
      const tree = renderer.create(React.createElement(ScoreRing, { score: 92 }));
      const text = collectText(tree.root);
      expect(text).toContain('92');
      expect(text).toContain('/ 100');
    });

    it('renders ScoreHistoryList with Vietnamese reason and signed delta', () => {
      const tree = renderer.create(
        React.createElement(ScoreHistoryList, {
          history: [
            {
              id: 'h1',
              delta: -5,
              reason: 'CANCEL_OVER_12H',
              bookingCode: 'HC-2026-1039',
              createdAt: '2026-11-15T09:00:00+07:00',
            },
          ],
        })
      );
      const text = collectText(tree.root);
      expect(text).toContain('Hủy ca trước giờ hẹn > 12h');
      expect(text).toContain('HC-2026-1039');
      expect(text).toContain('−5');
    });

    it('renders warning banner for score 65 and hides stars for blind reviews', async () => {
      mockSetScoreForTesting(65);
      const mockNav = { goBack: jest.fn(), navigate: jest.fn() } as any;
      let tree!: renderer.ReactTestRenderer;

      await act(async () => {
        tree = renderer.create(
          React.createElement(TrustScoreScreen, { navigation: mockNav })
        );
      });

      const text = collectText(tree.root);
      expect(text).toContain('Cảnh báo: Điểm sắp chạm ngưỡng 60');
      expect(text).toContain('Đánh giá đang được ẩn');
      // Blind review belongs to HC-2026-1057 (Bà Nguyễn Thị Hoa) — must not leak comment or stars
      expect(text).not.toContain('thao tác nhẹ nhàng');
    });

    it('renders suspended banner for score 55', async () => {
      mockSetScoreForTesting(55);
      const mockNav = { goBack: jest.fn(), navigate: jest.fn() } as any;
      let tree!: renderer.ReactTestRenderer;

      await act(async () => {
        tree = renderer.create(
          React.createElement(TrustScoreScreen, { navigation: mockNav })
        );
      });

      const text = collectText(tree.root);
      expect(text).toContain('Tài khoản đang tạm khóa nhận ca');
    });
  });
});
