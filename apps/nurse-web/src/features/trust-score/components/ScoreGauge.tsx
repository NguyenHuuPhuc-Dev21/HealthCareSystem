import React from 'react';

export interface ScoreGaugeProps {
  score: number;
  size?: number;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, size = 140 }) => {
  // Clamped score between 0 and 100
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  // Determine color based on threshold:
  // xanh ≥ 80, vàng 70–79, cam 60–69, đỏ < 60
  let strokeColor = 'var(--brand-jade)'; // default >= 80
  let textColor = 'var(--ink-primary)';
  let tierLabel = 'Mức rất tốt';

  if (clampedScore < 60) {
    strokeColor = 'var(--alert-crimson)';
    textColor = 'var(--alert-crimson)';
    tierLabel = 'Tạm khóa';
  } else if (clampedScore < 70) {
    strokeColor = '#EA580C'; // Cam cảnh báo
    textColor = '#EA580C';
    tierLabel = 'Cảnh báo';
  } else if (clampedScore < 80) {
    strokeColor = 'var(--accent-ochre)';
    textColor = 'var(--accent-ochre)';
    tierLabel = 'Khá';
  }

  // SVG circular progress calculation
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: size,
        height: size,
      }}
      role="meter"
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Điểm TrustScore: ${clampedScore} trên 100 (${tierLabel})`}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-subtle)"
          strokeWidth={strokeWidth}
        />
        {/* Progress active circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </svg>

      {/* Center Score & Label */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <span
          className="tabular-nums font-display"
          style={{
            fontSize: 40,
            fontWeight: 800,
            lineHeight: 1,
            color: textColor,
          }}
        >
          {clampedScore}
        </span>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: 'var(--ink-muted)',
            marginTop: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          / 100
        </span>
      </div>
    </div>
  );
};
