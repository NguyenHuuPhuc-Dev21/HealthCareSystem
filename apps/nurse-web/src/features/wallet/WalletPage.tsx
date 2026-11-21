import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  CreditCard,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import type {
  EarningsPointDto,
  UpcomingSettlementDto,
  WalletSummaryDto,
  WalletTransactionDto,
} from '@healthcare-system/shared';
import { USE_MOCK_WALLET } from '../../lib/mock-flags';
import {
  getEarnings,
  getUpcomingSettlements,
  getWalletSummary,
  getWalletTransactions,
} from './wallet.api';
import { mockSetDepositScenario } from './wallet.mock';
import { BalanceCards } from './components/BalanceCards';
import { EarningsChart } from './components/EarningsChart';
import { UpcomingSettlements } from './components/UpcomingSettlements';
import { TransactionList } from './components/TransactionList';

export const WalletPage: React.FC = () => {
  const [summary, setSummary] = useState<WalletSummaryDto | null>(null);
  const [upcomingSettlements, setUpcomingSettlements] = useState<UpcomingSettlementDto[]>([]);
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Filter & Chart range state
  const [activeTxFilter, setActiveTxFilter] = useState<string>('ALL');
  const [earningsRange, setEarningsRange] = useState<'week' | 'month'>('week');
  const [earningsPoints, setEarningsPoints] = useState<EarningsPointDto[]>([]);
  const [earningsTotal, setEarningsTotal] = useState<number>(0);
  const [periodLabel, setPeriodLabel] = useState<string>('Tuần này');

  // Loading & Error states
  const [loading, setLoading] = useState<boolean>(true);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [loadingMoreTx, setLoadingMoreTx] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Load all initial wallet data in parallel (eliminating waterfalls)
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [sumRes, settRes, earnRes, txRes] = await Promise.all([
        getWalletSummary(),
        getUpcomingSettlements(),
        getEarnings(earningsRange),
        getWalletTransactions({ type: activeTxFilter }),
      ]);

      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
      } else {
        setPageError(sumRes.error?.message || 'Không thể tải thông tin số dư ví.');
      }

      if (settRes.success && settRes.data) {
        setUpcomingSettlements(settRes.data);
      }

      if (earnRes.success && earnRes.data) {
        setEarningsPoints(earnRes.data.points);
        setEarningsTotal(earnRes.data.totalAmount);
        setPeriodLabel(earnRes.data.periodLabel);
      }

      if (txRes.success && txRes.data) {
        setTransactions(txRes.data.items);
        setNextCursor(txRes.data.nextCursor || null);
      }
    } catch {
      setPageError('Lỗi kết nối máy chủ khi tải dữ liệu ví.');
    } finally {
      setLoading(false);
    }
  }, [activeTxFilter, earningsRange]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load chart when range toggled
  const handleRangeChange = async (newRange: 'week' | 'month') => {
    setEarningsRange(newRange);
    setChartLoading(true);
    try {
      const earnRes = await getEarnings(newRange);
      if (earnRes.success && earnRes.data) {
        setEarningsPoints(earnRes.data.points);
        setEarningsTotal(earnRes.data.totalAmount);
        setPeriodLabel(earnRes.data.periodLabel);
      }
    } finally {
      setChartLoading(false);
    }
  };

  // Filter transactions
  const handleFilterChange = async (filterKey: string) => {
    setActiveTxFilter(filterKey);
    try {
      const res = await getWalletTransactions({ type: filterKey });
      if (res.success && res.data) {
        setTransactions(res.data.items);
        setNextCursor(res.data.nextCursor || null);
      }
    } catch {
      // ignore
    }
  };

  // Pagination: Load more transactions
  const handleLoadMoreTx = async () => {
    if (!nextCursor || loadingMoreTx) return;
    setLoadingMoreTx(true);
    try {
      const res = await getWalletTransactions({
        type: activeTxFilter,
        cursor: nextCursor,
      });
      if (res.success && res.data) {
        setTransactions((prev) => [...prev, ...res.data.items]);
        setNextCursor(res.data.nextCursor || null);
      }
    } finally {
      setLoadingMoreTx(false);
    }
  };

  // Test helper: Switch deposit scenarios
  const handleScenarioChange = (scenario: 'FULL' | 'SHORTFALL_180K' | 'GRACE_ACTIVE') => {
    mockSetDepositScenario(scenario);
    loadInitialData();
  };

  return (
    <div className="screen-body elder">
      <div className="page">
        {/* Page Header */}
        <div className="page-head" style={{ marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--navy, #0F172A)', margin: 0 }}>
              Ví &amp; thu nhập
            </h1>
            <p style={{ fontSize: '16px', color: 'var(--text-secondary, #64748B)', margin: '6px 0 0' }}>
              Ba ngăn tách bạch — mọi biến động đều có dòng sổ cái riêng, không sửa, không xóa
            </p>
          </div>

          <div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadInitialData}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                fontSize: '15px',
                fontWeight: 700,
                borderRadius: 12,
              }}
            >
              <RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden="true" />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Banner kiểm thử Demo Mock */}
        {USE_MOCK_WALLET && (
          <div
            style={{
              padding: '12px 18px',
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 14,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              fontSize: '14.5px',
            }}
          >
            <div style={{ color: '#166534', fontWeight: 600 }}>
              🧪 <b>Thử nghiệm kịch bản ký quỹ:</b>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleScenarioChange('FULL')}
                style={{ padding: '4px 10px', fontSize: '13px', borderRadius: 8 }}
              >
                1. Đủ 300.000đ (Bình thường)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleScenarioChange('SHORTFALL_180K')}
                style={{
                  padding: '4px 10px',
                  fontSize: '13px',
                  borderRadius: 8,
                  borderColor: '#F59E0B',
                  color: '#B45309',
                }}
              >
                2. Thiếu 180.000đ (Chặn nhận ca)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleScenarioChange('GRACE_ACTIVE')}
                style={{
                  padding: '4px 10px',
                  fontSize: '13px',
                  borderRadius: 8,
                  borderColor: '#0284C7',
                  color: '#0369A1',
                }}
              >
                3. Ân hạn ADR-0004 (Chỉ ca CK)
              </button>
            </div>
          </div>
        )}

        {/* Lỗi tải trang nếu có */}
        {pageError && (
          <div
            className="card"
            style={{
              padding: '18px 22px',
              background: '#FEF2F2',
              borderColor: '#FECACA',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#DC2626' }}>
              <AlertCircle size={22} aria-hidden="true" />
              <span style={{ fontSize: '15.5px', fontWeight: 700 }}>{pageError}</span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={loadInitialData}
              style={{ padding: '8px 16px', fontSize: '14px', borderRadius: 8 }}
            >
              Thử lại
            </button>
          </div>
        )}

        {/* 3 Thẻ số dư ví */}
        {summary && <BalanceCards summary={summary} />}

        {/* Quick action buttons */}
        <div className="quick-acts" role="navigation" aria-label="Lối tắt thao tác ví">
          <Link to="/wallet/deposit">
            <PlusCircle size={22} color="var(--brand-jade, #166B58)" aria-hidden="true" />
            <span>Nạp ký quỹ điều dưỡng</span>
          </Link>

          <Link to="/wallet/withdraw">
            <Building2 size={22} color="var(--brand-jade, #166B58)" aria-hidden="true" />
            <span>Rút tiền về ngân hàng</span>
          </Link>

          <Link to="/wallet/commission">
            <CreditCard size={22} color="#D97706" aria-hidden="true" />
            <span>Nộp hoa hồng ca tiền mặt</span>
          </Link>
        </div>

        {/* 2 Cột nội dung: Biểu đồ + Sắp quyết toán & Lịch sử giao dịch */}
        <div className="cols-2" style={{ alignItems: 'start' }}>
          {/* Cột trái: Biểu đồ thu nhập + Sắp quyết toán */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <EarningsChart
              range={earningsRange}
              onRangeChange={handleRangeChange}
              points={earningsPoints}
              totalAmount={earningsTotal}
              periodLabel={periodLabel}
              loading={chartLoading}
            />

            <UpcomingSettlements settlements={upcomingSettlements} />
          </div>

          {/* Cột phải: Lịch sử giao dịch sổ cái */}
          <div>
            <TransactionList
              transactions={transactions}
              activeFilter={activeTxFilter}
              onFilterChange={handleFilterChange}
              onLoadMore={handleLoadMoreTx}
              hasMore={Boolean(nextCursor)}
              loadingMore={loadingMoreTx}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
