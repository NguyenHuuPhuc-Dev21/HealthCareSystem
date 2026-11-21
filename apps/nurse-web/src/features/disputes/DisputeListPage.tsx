import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Clock,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { DisputeDto, DisputeStatus } from '@healthcare-system/shared';
import { getMyDisputes } from './disputes.api';
import { formatDateTime } from '../../lib/formatters';

type TabFilter = 'all' | 'need_rebuttal' | 'under_review' | 'resolved';

export const DisputeListPage: React.FC = () => {
  const [disputes, setDisputes] = useState<DisputeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabFilter>('all');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyDisputes();
      if (res.success && res.data) {
        setDisputes(res.data);
      } else {
        setError(res.error?.message || 'Không thể tải danh sách khiếu nại');
      }
    } catch {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Đưa các khiếu nại cần phản hồi lên đầu danh sách
  const sortedDisputes = [...disputes].sort((a, b) => {
    const aNeedsRebuttal = a.openedBy === 'PATIENT' && a.status === DisputeStatus.OPEN ? 1 : 0;
    const bNeedsRebuttal = b.openedBy === 'PATIENT' && b.status === DisputeStatus.OPEN ? 1 : 0;
    if (aNeedsRebuttal !== bNeedsRebuttal) return bNeedsRebuttal - aNeedsRebuttal;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const needRebuttalCount = disputes.filter(
    (d) => d.openedBy === 'PATIENT' && d.status === DisputeStatus.OPEN
  ).length;

  const underReviewCount = disputes.filter(
    (d) => d.status === DisputeStatus.UNDER_REVIEW
  ).length;

  const resolvedCount = disputes.filter(
    (d) =>
      d.status === DisputeStatus.RESOLVED_CUSTOMER ||
      d.status === DisputeStatus.RESOLVED_NURSE ||
      d.status === DisputeStatus.RESOLVED_PARTIAL
  ).length;

  const filteredDisputes = sortedDisputes.filter((d) => {
    if (tab === 'need_rebuttal') {
      return d.openedBy === 'PATIENT' && d.status === DisputeStatus.OPEN;
    }
    if (tab === 'under_review') {
      return d.status === DisputeStatus.UNDER_REVIEW;
    }
    if (tab === 'resolved') {
      return (
        d.status === DisputeStatus.RESOLVED_CUSTOMER ||
        d.status === DisputeStatus.RESOLVED_NURSE ||
        d.status === DisputeStatus.RESOLVED_PARTIAL
      );
    }
    return true;
  });

  const renderStatusBadge = (status: DisputeStatus) => {
    switch (status) {
      case DisputeStatus.OPEN:
        return (
          <span className="status-pill status-pill--ochre" style={{ fontSize: 12 }}>
            <Clock size={13} aria-hidden="true" />
            Đang mở
          </span>
        );
      case DisputeStatus.UNDER_REVIEW:
        return (
          <span className="status-pill status-pill--neutral" style={{ fontSize: 12 }}>
            <Scale size={13} aria-hidden="true" />
            Đang thẩm tra
          </span>
        );
      case DisputeStatus.RESOLVED_NURSE:
        return (
          <span className="status-pill status-pill--jade" style={{ fontSize: 12 }}>
            <ShieldCheck size={13} aria-hidden="true" />
            Thắng khiếu nại (Giữ thù lao)
          </span>
        );
      case DisputeStatus.RESOLVED_CUSTOMER:
        return (
          <span className="status-pill status-pill--crimson" style={{ fontSize: 12 }}>
            <AlertCircle size={13} aria-hidden="true" />
            Khách thắng (Trừ điểm/phạt)
          </span>
        );
      default:
        return <span className="status-pill">{status}</span>;
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Scale size={26} color="var(--brand-jade)" aria-hidden="true" />
            <h1 style={{ margin: 0 }}>Khiếu nại &amp; Phản hồi</h1>
          </div>
          <p style={{ margin: '4px 0 0' }}>
            Theo dõi phân xử ca trực (FR-DISP-01) và khiếu nại các khoản trừ ký quỹ (ADR-0004 D3)
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="btn btn-secondary btn-sm"
          style={{ minHeight: 40, padding: '0 14px' }}
          disabled={loading}
          aria-label="Tải lại danh sách"
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} aria-hidden="true" />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Urgent Warning if action needed */}
      {!loading && needRebuttalCount > 0 && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 18px',
            borderRadius: 12,
            background: 'var(--accent-ochre-soft)',
            border: '1.5px solid var(--accent-ochre)',
            color: '#78350F',
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={22} style={{ flexShrink: 0 }} aria-hidden="true" />
            <div>
              <b style={{ fontSize: 15 }}>Bạn có {needRebuttalCount} khiếu nại đang chờ phản hồi!</b>
              <div style={{ fontSize: 13, marginTop: 2 }}>
                Vui lòng gửi văn bản giải trình và bằng chứng trước khi hết hạn để bảo vệ quyền lợi thù
                lao và điểm TrustScore của bạn.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setTab('need_rebuttal')}
            style={{
              background: 'var(--accent-ochre)',
              borderColor: 'var(--accent-ochre)',
              color: '#fff',
            }}
          >
            Xem khiếu nại cần phản hồi
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'var(--alert-crimson-soft)',
            color: 'var(--alert-crimson)',
            border: '1px solid #FECACA',
            marginBottom: 20,
            fontSize: 14,
          }}
        >
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div
        className="shift-tabs"
        role="tablist"
        aria-label="Lọc theo trạng thái khiếu nại"
        style={{ marginBottom: 16 }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'all'}
          className={tab === 'all' ? 'active' : ''}
          onClick={() => setTab('all')}
        >
          Tất cả ({disputes.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'need_rebuttal'}
          className={tab === 'need_rebuttal' ? 'active' : ''}
          onClick={() => setTab('need_rebuttal')}
        >
          Cần phản hồi
          {needRebuttalCount > 0 && (
            <span
              style={{
                marginLeft: 6,
                padding: '1px 7px',
                borderRadius: 999,
                background: 'var(--accent-ochre)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {needRebuttalCount}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'under_review'}
          className={tab === 'under_review' ? 'active' : ''}
          onClick={() => setTab('under_review')}
        >
          Đang thẩm tra ({underReviewCount})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'resolved'}
          className={tab === 'resolved' ? 'active' : ''}
          onClick={() => setTab('resolved')}
        >
          Đã giải quyết ({resolvedCount})
        </button>
      </div>

      {/* Disputes list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--ink-muted)' }}>
          Đang tải danh sách khiếu nại...
        </div>
      ) : filteredDisputes.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '44px 20px',
            color: 'var(--ink-muted)',
            background: 'var(--surface-paper)',
          }}
        >
          <Scale size={42} style={{ opacity: 0.35, marginBottom: 10 }} aria-hidden="true" />
          <h3 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--ink-primary)' }}>
            Không có khiếu nại nào trong danh mục này
          </h3>
          <p style={{ margin: 0, fontSize: 13.5 }}>
            Hệ thống luôn đảm bảo mọi sự cố đều được giải quyết minh bạch và công bằng.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredDisputes.map((item) => {
            const isPatientDispute = item.openedBy === 'PATIENT';
            const isNeedRebuttal = isPatientDispute && item.status === DisputeStatus.OPEN;
            const isPenaltyAppeal = item.kind === 'PENALTY_APPEAL';

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: '20px 22px',
                  background: isNeedRebuttal ? '#FFFDF8' : 'var(--surface-paper)',
                  border: isNeedRebuttal
                    ? '1.5px solid var(--accent-ochre)'
                    : '1px solid var(--border-hairline)',
                  position: 'relative',
                  boxShadow: isNeedRebuttal ? '0 3px 10px rgba(180, 83, 9, 0.08)' : undefined,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {isPenaltyAppeal ? (
                      <span
                        className="status-pill status-pill--ochre"
                        style={{ fontSize: 11.5, padding: '2px 8px' }}
                      >
                        <ShieldAlert size={12} aria-hidden="true" />
                        Khiếu nại trừ ký quỹ
                      </span>
                    ) : (
                      <span
                        className="status-pill status-pill--neutral"
                        style={{ fontSize: 11.5, padding: '2px 8px' }}
                      >
                        <FileText size={12} aria-hidden="true" />
                        Khiếu nại ca trực
                      </span>
                    )}

                    <b style={{ color: 'var(--ink-primary)', fontSize: 16 }}>
                      {isPenaltyAppeal ? 'Khấu trừ ký quỹ' : `Đơn ${item.bookingCode}`}
                    </b>

                    <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                      · {formatDateTime(item.createdAt)}
                    </span>
                  </div>

                  <div>{renderStatusBadge(item.status)}</div>
                </div>

                {/* Sender badge & Reason */}
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: isPatientDispute ? 'var(--alert-crimson)' : 'var(--brand-jade)',
                      marginBottom: 4,
                    }}
                  >
                    {isPatientDispute ? 'Khách hàng khiếu nại:' : 'Bạn đã mở khiếu nại:'}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: 'var(--ink-primary)',
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.description}
                  </p>
                </div>

                {/* Additional metadata info */}
                {isPenaltyAppeal && item.penaltyAmount && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--surface-canvas)',
                      fontSize: 13,
                      marginBottom: 12,
                    }}
                  >
                    <span>Số tiền phạt bị khiếu nại:</span>
                    <b style={{ color: 'var(--alert-crimson)' }}>
                      {item.penaltyAmount.toLocaleString('vi-VN')} đ
                    </b>
                    {item.penaltyReason && (
                      <span style={{ color: 'var(--ink-muted)' }}>({item.penaltyReason})</span>
                    )}
                  </div>
                )}

                {/* Action footer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-hairline)',
                    paddingTop: 12,
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13 }}>
                    {item.evidences.length > 0 && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          color: 'var(--ink-secondary)',
                        }}
                      >
                        <ImageIcon size={14} aria-hidden="true" />
                        <span>{item.evidences.length} bằng chứng đính kèm</span>
                      </span>
                    )}

                    {isNeedRebuttal && item.rebuttalDueAt && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          color: 'var(--accent-ochre)',
                          fontWeight: 600,
                        }}
                      >
                        <Clock size={14} aria-hidden="true" />
                        <span>Hạn phản hồi: {formatDateTime(item.rebuttalDueAt)}</span>
                      </span>
                    )}
                  </div>

                  <Link
                    to={`/disputes/${item.id}`}
                    className={`btn ${isNeedRebuttal ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{
                      fontSize: 13.5,
                      textDecoration: 'none',
                      background: isNeedRebuttal ? 'var(--accent-ochre)' : undefined,
                      borderColor: isNeedRebuttal ? 'var(--accent-ochre)' : undefined,
                    }}
                  >
                    <span>{isNeedRebuttal ? 'Phản hồi ngay' : 'Xem chi tiết'}</span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
