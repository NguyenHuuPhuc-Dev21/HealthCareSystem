import React, { useState } from 'react';
import type { EarningsPointDto } from '@healthcare-system/shared';
import { formatVND } from '../../../lib/formatters';

export interface EarningsChartProps {
  range: 'week' | 'month';
  onRangeChange: (range: 'week' | 'month') => void;
  points: EarningsPointDto[];
  totalAmount: number;
  periodLabel: string;
  loading?: boolean;
}

export const EarningsChart: React.FC<EarningsChartProps> = ({
  range,
  onRangeChange,
  points,
  totalAmount,
  periodLabel,
  loading = false,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // SVG viewBox coordinates
  const svgWidth = 460;
  const svgHeight = 160;
  const chartBottom = 130;
  const chartTop = 20;
  const maxBarHeight = chartBottom - chartTop;

  // Tính giá trị lớn nhất để chuẩn hóa chiều cao cột
  const maxVal = Math.max(...points.map((p) => p.amount), 500000);

  const numBars = points.length;
  const availableWidth = svgWidth - 40;
  const barWidth = numBars > 0 ? Math.min(38, Math.max(24, Math.floor(availableWidth / (numBars * 1.6)))) : 32;
  const gap = numBars > 1 ? (availableWidth - numBars * barWidth) / (numBars - 1) : 0;
  const startX = 20;

  return (
    <div className="card" style={{ padding: '22px 24px' }}>
      <div className="bars-chart-header">
        <div>
          <h3 style={{ color: 'var(--navy, #0F172A)', fontSize: '18px', margin: 0, fontWeight: 800 }}>
            {range === 'week' ? 'Thu nhập theo tuần' : 'Thu nhập theo tháng'}
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary, #64748B)', margin: '4px 0 0' }}>
            Tổng kết thu nhập thực nhận các ca đã hoàn thành
          </p>
        </div>

        {/* Nút bấm chọn Tuần / Tháng */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--surface-subtle, #F1F5F9)',
              padding: 3,
              borderRadius: 10,
            }}
          >
            <button
              type="button"
              onClick={() => onRangeChange('week')}
              style={{
                padding: '6px 14px',
                fontSize: '14px',
                fontWeight: 700,
                border: 0,
                borderRadius: 8,
                background: range === 'week' ? '#ffffff' : 'transparent',
                color: range === 'week' ? 'var(--brand-jade, #166B58)' : 'var(--text-secondary, #64748B)',
                boxShadow: range === 'week' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              Tuần
            </button>
            <button
              type="button"
              onClick={() => onRangeChange('month')}
              style={{
                padding: '6px 14px',
                fontSize: '14px',
                fontWeight: 700,
                border: 0,
                borderRadius: 8,
                background: range === 'month' ? '#ffffff' : 'transparent',
                color: range === 'month' ? 'var(--brand-jade, #166B58)' : 'var(--text-secondary, #64748B)',
                boxShadow: range === 'month' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              Tháng
            </button>
          </div>
        </div>
      </div>

      {/* Chip hiển thị tổng */}
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--brand-jade-soft, #E6F4F1)',
            color: 'var(--brand-jade, #166B58)',
            fontSize: '15px',
            fontWeight: 800,
            padding: '5px 12px',
            borderRadius: 8,
          }}
        >
          {periodLabel}: {formatVND(totalAmount)}
        </span>

        {hoveredIdx !== null && points[hoveredIdx] && (
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--navy, #0F172A)' }}>
            {points[hoveredIdx].label}: {formatVND(points[hoveredIdx].amount)}
          </span>
        )}
      </div>

      {/* Biểu đồ cột SVG tự vẽ */}
      <div className="bars-chart-svg-wrap" style={{ marginTop: 12, position: 'relative' }}>
        {loading ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary, #64748B)',
            }}
          >
            Đang tải dữ liệu biểu đồ...
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: '100%', height: '100%', display: 'block' }}
            role="img"
            aria-label={`Biểu đồ cột thu nhập ${periodLabel}`}
          >
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#166B58" />
                <stop offset="100%" stopColor="#5FB3A1" />
              </linearGradient>
              <linearGradient id="barHoverGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0F4F41" />
                <stop offset="100%" stopColor="#439A87" />
              </linearGradient>
            </defs>

            {/* Trục hoành baseline */}
            <line
              x1="10"
              y1={chartBottom}
              x2={svgWidth - 10}
              y2={chartBottom}
              stroke="var(--border-hairline, #E2E8F0)"
              strokeWidth="1.5"
            />

            {/* Các cột bar và nhãn */}
            {points.map((p, idx) => {
              const barHeight = Math.max(6, Math.round((p.amount / maxVal) * maxBarHeight));
              const x = startX + idx * (barWidth + gap);
              const y = chartBottom - barHeight;
              const isHovered = hoveredIdx === idx;

              return (
                <g
                  key={p.label}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Vùng cảm ứng hover mở rộng */}
                  <rect
                    x={x - 4}
                    y={chartTop}
                    width={barWidth + 8}
                    height={chartBottom - chartTop + 24}
                    fill="transparent"
                  />

                  {/* Cột chính */}
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="6"
                    ry="6"
                    fill={isHovered ? 'url(#barHoverGradient)' : 'url(#barGradient)'}
                    style={{ transition: 'all 0.15s ease' }}
                  />

                  {/* Nhãn nhãn trục X */}
                  <text
                    x={x + barWidth / 2}
                    y={chartBottom + 18}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight={isHovered ? '800' : '600'}
                    fill={isHovered ? 'var(--navy, #0F172A)' : 'var(--text-secondary, #64748B)'}
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};
