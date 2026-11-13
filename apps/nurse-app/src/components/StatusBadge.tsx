import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../styles/tokens';

export type BadgeTone = 'jade' | 'ochre' | 'crimson' | 'neutral';

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone = 'neutral' }) => {
  const palette =
    tone === 'jade'
      ? { bg: tokens.colors.brandJadeSoft, fg: tokens.colors.brandJade }
      : tone === 'ochre'
      ? { bg: tokens.colors.accentOchreSoft, fg: tokens.colors.accentOchre }
      : tone === 'crimson'
      ? { bg: tokens.colors.alertCrimsonSoft, fg: tokens.colors.alertCrimson }
      : { bg: tokens.colors.subtle, fg: tokens.colors.inkSecondary };

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radii.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});

