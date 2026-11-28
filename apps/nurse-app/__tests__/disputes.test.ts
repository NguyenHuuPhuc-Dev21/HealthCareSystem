import React from 'react';
import {
  canOpenDisputeAfterCheckout,
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_MAX_EVIDENCE_FILES,
  DISPUTE_MAX_FILE_SIZE_BYTES,
  DISPUTE_MAX_VIDEO_DURATION_SECONDS,
  DisputeStatus,
} from '@healthcare-system/shared';
import renderer, { act } from 'react-test-renderer';
import {
  getDispute,
  getEvidenceUploadUrls,
  getMyDisputes,
  openDispute,
  resetDisputesMockState,
  submitDisputeRebuttal,
} from '../src/features/disputes/disputes.api';
import { validateEvidenceAsset } from '../src/features/disputes/components/EvidencePicker';
import { sortDisputesForNurse } from '../src/features/disputes/DisputeListScreen';
import { DisputeDetailScreen } from '../src/features/disputes/DisputeDetailScreen';

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

describe('A15 — Disputes & Rebuttals (nurse-app)', () => {
  beforeEach(() => {
    resetDisputesMockState();
  });

  describe('1. Check-out 24h window for opening dispute', () => {
    const NOW_MS = new Date('2026-11-25T10:00:00+07:00').getTime();

    it('allows opening dispute within 24 hours after check-out', () => {
      const checkOut5hAgo = new Date(NOW_MS - 5 * 3600 * 1000).toISOString();
      const checkOut24hAgo = new Date(NOW_MS - 24 * 3600 * 1000).toISOString();
      expect(canOpenDisputeAfterCheckout(checkOut5hAgo, NOW_MS)).toBe(true);
      expect(canOpenDisputeAfterCheckout(checkOut24hAgo, NOW_MS)).toBe(true);
    });

    it('blocks opening dispute after 24 hours (e.g. 25 hours after check-out)', () => {
      const checkOut25hAgo = new Date(NOW_MS - 25 * 3600 * 1000).toISOString();
      expect(canOpenDisputeAfterCheckout(checkOut25hAgo, NOW_MS)).toBe(false);
      expect(canOpenDisputeAfterCheckout(null, NOW_MS)).toBe(false);
      expect(canOpenDisputeAfterCheckout(undefined, NOW_MS)).toBe(false);
    });
  });

  describe('2. EvidencePicker 5-file, 20MB, 60s validation', () => {
    it('allows up to 5 valid files and blocks the 6th file', () => {
      for (let count = 0; count < DISPUTE_MAX_EVIDENCE_FILES; count += 1) {
        const res = validateEvidenceAsset(
          { uri: `file:///photo_${count}.jpg`, type: 'image/jpeg', fileSize: 1024 * 1024 },
          count
        );
        expect(res.valid).toBe(true);
      }

      const sixth = validateEvidenceAsset(
        { uri: 'file:///photo_6.jpg', type: 'image/jpeg', fileSize: 1024 * 1024 },
        DISPUTE_MAX_EVIDENCE_FILES
      );
      expect(sixth.valid).toBe(false);
    });

    it('blocks files larger than 20 MB and videos longer than 60s', () => {
      const tooBig = validateEvidenceAsset(
        {
          uri: 'file:///huge.jpg',
          type: 'image/jpeg',
          fileSize: DISPUTE_MAX_FILE_SIZE_BYTES + 1,
        },
        0
      );
      expect(tooBig.valid).toBe(false);

      const tooLongVideo = validateEvidenceAsset(
        {
          uri: 'file:///clip.mp4',
          type: 'video/mp4',
          fileSize: 5 * 1024 * 1024,
          duration: DISPUTE_MAX_VIDEO_DURATION_SECONDS + 1,
        },
        0
      );
      expect(tooLongVideo.valid).toBe(false);
    });
  });

  describe('3. Disputes API, sorting, and ADR-0004 PENALTY_APPEAL', () => {
    it('loads disputes including PENALTY_APPEAL under review and sorts needs-rebuttal first', async () => {
      const res = await getMyDisputes();
      expect(res.success).toBe(true);
      expect(res.data.some((d) => d.kind === 'PENALTY_APPEAL' && d.status === DisputeStatus.UNDER_REVIEW)).toBe(true);

      const sorted = sortDisputesForNurse(res.data);
      expect(sorted[0].status).toBe(DisputeStatus.OPEN);
      expect(sorted[0].openedBy).toBe('PATIENT');
      expect(sorted[0].nurseRebuttal).toBeNull();
    });

    it('opens a new dispute with Vietnamese category and fetches detail', async () => {
      expect(DISPUTE_CATEGORY_LABELS.UNPROFESSIONAL_CONDUCT.title).toBeTruthy();

      const openRes = await openDispute('booking-999', {
        category: 'UNPROFESSIONAL_CONDUCT',
        description: 'Gia đình có thái độ không hợp tác và yêu cầu việc ngoài chuyên môn.',
      });
      expect(openRes.success).toBe(true);

      const detailRes = await getDispute(openRes.data.dispute_id);
      expect(detailRes.success).toBe(true);
      expect(detailRes.data.openedBy).toBe('NURSE');
      expect(detailRes.data.status).toBe(DisputeStatus.UNDER_REVIEW);
    });

    it('gets presigned upload URLs and submits rebuttal', async () => {
      const urlRes = await getEvidenceUploadUrls('disp-001', ['a.jpg', 'b.mp4']);
      expect(urlRes.success).toBe(true);
      expect(urlRes.data).toHaveLength(2);

      const rebRes = await submitDisputeRebuttal(
        'disp-001',
        'Tôi đã hoàn thành đủ thời gian ca trực và có xác nhận của gia đình.',
        urlRes.data.map((u) => u.publicUrl)
      );
      expect(rebRes.success).toBe(true);
      expect(rebRes.data.updated).toBe(true);

      const updated = await getDispute('disp-001');
      expect(updated.data.status).toBe(DisputeStatus.UNDER_REVIEW);
      expect(updated.data.nurseRebuttal?.evidences).toHaveLength(2);
    });
  });

  describe('4. DisputeDetailScreen rendering for PENALTY_APPEAL & RESOLVED_CUSTOMER', () => {
    it('renders PENALTY_APPEAL details for disp-006', async () => {
      const mockNav = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() } as any;
      const mockRoute = { params: { disputeId: 'disp-006' } } as any;
      let tree!: renderer.ReactTestRenderer;

      await act(async () => {
        tree = renderer.create(
          React.createElement(DisputeDetailScreen, { navigation: mockNav, route: mockRoute })
        );
      });

      const text = collectText(tree.root);
      expect(text).toContain('KHOẢN TRỪ KÝ QUỸ BỊ KHIẾU NẠI');
      expect(text).toContain('BK-20261108-011');
      expect(text).toContain('NURSE_LATE_CANCEL');
    });

    it('renders no-reappeal notice on RESOLVED_CUSTOMER (DISPUTE_UPHELD)', async () => {
      const mockNav = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() } as any;
      const mockRoute = { params: { disputeId: 'disp-004' } } as any;
      let tree!: renderer.ReactTestRenderer;

      await act(async () => {
        tree = renderer.create(
          React.createElement(DisputeDetailScreen, { navigation: mockNav, route: mockRoute })
        );
      });

      const text = collectText(tree.root);
      expect(text).toContain('DISPUTE_UPHELD');
      expect(text).toContain('không thể khiếu nại lại');
    });
  });
});
