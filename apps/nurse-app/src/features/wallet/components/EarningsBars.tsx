import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import type { EarningsPointDto } from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';

interface EarningsBarsProps {
  points: EarningsPointDto[];
  totalAmount: number;
  periodLabel?: string;
}

export const EarningsBars: React.FC<EarningsBarsProps> = ({
  points,
  totalAmount,
  periodLabel = 'Tuần này',
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(280, screenWidth - 72);
  const chartHeight = 140;
  const paddingBottom = 24;
  const paddingTop = 20;
  const usableHeight = chartHeight - paddingBottom - paddingTop;

  const maxAmount = Math.max(1, ...points.map((p) => p.amount));
  const barCount = points.length || 7;
  const colWidth = chartWidth / barCount;
  const barWidth = Math.min(26, colWidth * 0.6);

  const selectedPoint = selectedIdx !== null ? points[selectedIdx] : null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Thu nhập theo tuần</Text>
        <View style={styles.chip}>
          <Text style={styles.chipText}>
            {periodLabel}: {totalAmount.toLocaleString('vi-VN')}đ
          </Text>
        </View>
      </View>

      {/* Selected Day Amount Banner */}
      {selectedPoint ? (
        <View style={styles.selectedBanner}>
          <Text style={styles.selectedDayText}>Ngày {selectedPoint.label}:</Text>
          <Text style={styles.selectedAmountText}>
            +{selectedPoint.amount.toLocaleString('vi-VN')}đ
          </Text>
        </View>
      ) : (
        <Text style={styles.hintText}>Chạm vào một cột để xem số tiền từng ngày</Text>
      )}

      {/* SVG Chart */}
      <View style={styles.chartWrap}>
        <Svg width={chartWidth} height={chartHeight}>
          {/* Baseline */}
          <Line
            x1="0"
            y1={chartHeight - paddingBottom}
            x2={chartWidth}
            y2={chartHeight - paddingBottom}
            stroke={tokens.colors.borderHairline}
            strokeWidth="1"
          />

          {points.map((p, idx) => {
            const barHeight = Math.max(6, (p.amount / maxAmount) * usableHeight);
            const x = idx * colWidth + (colWidth - barWidth) / 2;
            const y = chartHeight - paddingBottom - barHeight;
            const isSelected = selectedIdx === idx;

            return (
              <G key={p.label}>
                {/* Bar */}
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="6"
                  ry="6"
                  fill={
                    isSelected
                      ? tokens.colors.brandJadeDark
                      : p.amount > 0
                      ? tokens.colors.brandJade
                      : '#E2E8F0'
                  }
                />

                {/* Day Label */}
                <SvgText
                  x={x + barWidth / 2}
                  y={chartHeight - 6}
                  fontSize="12.5"
                  fontWeight={isSelected ? '800' : '600'}
                  fill={isSelected ? tokens.colors.brandJadeDark : tokens.colors.inkSecondary}
                  textAnchor="middle"
                >
                  {p.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        {/* Transparent Touch Overlays for Bar Selection */}
        <View style={[StyleSheet.absoluteFill, styles.touchRow]}>
          {points.map((p, idx) => (
            <TouchableOpacity
              key={p.label}
              style={{ flex: 1, height: chartHeight }}
              onPress={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${p.label}: ${p.amount.toLocaleString('vi-VN')} đồng`}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.paper,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  chip: {
    backgroundColor: tokens.colors.brandJadeSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.brandJade,
  },
  hintText: {
    fontSize: 13,
    color: tokens.colors.inkMuted,
    marginBottom: 8,
  },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F7FEFB',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.brandJadeSoft,
    marginBottom: 8,
  },
  selectedDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  selectedAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.brandJade,
  },
  chartWrap: {
    alignItems: 'center',
    position: 'relative',
    marginTop: 6,
  },
  touchRow: {
    flexDirection: 'row',
  },
});
