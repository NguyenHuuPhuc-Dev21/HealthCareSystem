import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { tokens } from '../../../styles/tokens';
import { getScoreTierMeta } from '../trust-score-labels';

export interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 152,
  strokeWidth = 12,
}) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const tierMeta = getScoreTierMeta(clampedScore);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;
  const center = size / 2;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clampedScore }}
      accessibilityLabel={`Điểm TrustScore ${clampedScore} trên 100, ${tierMeta.label}`}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={tokens.colors.subtle}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={tierMeta.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.centerOverlay} pointerEvents="none">
        <Text style={[styles.scoreValue, { color: tierMeta.color }]}>
          {clampedScore}
        </Text>
        <Text style={styles.scoreMax}>/ 100</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 44,
    fontVariant: ['tabular-nums'],
  },
  scoreMax: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.inkMuted,
    marginTop: 2,
  },
});
