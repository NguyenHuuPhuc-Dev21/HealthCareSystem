import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { TRUST_SCORE_RULES } from '../trust-score-labels';

function formatSignedPoints(delta: number): string {
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${Math.abs(delta)} điểm`;
}

export const ScoreRulesCard: React.FC = () => {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>QUY TẮC TÍNH ĐIỂM (TỐI ĐA 100)</Text>
      {TRUST_SCORE_RULES.map((rule, index) => {
        const isPositive = rule.delta > 0;
        const isMildPenalty = rule.delta < 0 && rule.delta >= -5;
        const deltaColor = isPositive
          ? tokens.colors.success
          : isMildPenalty
            ? tokens.colors.accentOchre
            : tokens.colors.alertCrimson;

        return (
          <View
            key={rule.reason}
            style={[
              styles.row,
              index === TRUST_SCORE_RULES.length - 1 && styles.rowLast,
            ]}
          >
            <Text style={styles.ruleTitle}>{rule.title}</Text>
            <Text style={[styles.ruleDelta, { color: deltaColor }]}>
              {formatSignedPoints(rule.delta)}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.subtle,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderHairline,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heading: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.inkMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderHairline,
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  ruleTitle: {
    flex: 1,
    fontSize: 14.5,
    color: tokens.colors.inkPrimary,
    lineHeight: 20,
  },
  ruleDelta: {
    fontSize: 14.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
