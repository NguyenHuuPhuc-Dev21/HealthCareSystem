import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { STAR_RATING_LABELS } from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';

export interface StarRowProps {
  value: number;
  onChange: (rating: 1 | 2 | 3 | 4 | 5) => void;
  disabled?: boolean;
}

const STARS: readonly (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

export const StarRow: React.FC<StarRowProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const activeLabel =
    value >= 1 && value <= 5
      ? STAR_RATING_LABELS[value as 1 | 2 | 3 | 4 | 5]
      : 'Chạm để chọn số sao';

  return (
    <View style={styles.wrapper}>
      <View style={styles.row} accessibilityRole="radiogroup">
        {STARS.map((star) => {
          const filled = star <= value;
          return (
            <TouchableOpacity
              key={star}
              style={styles.starBtn}
              onPress={() => onChange(star)}
              disabled={disabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${star} trên 5 sao`}
              accessibilityState={{ selected: value === star, disabled }}
            >
              <Star
                size={34}
                color={filled ? '#F59E0B' : '#CBD5E1'}
                fill={filled ? '#F59E0B' : 'transparent'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.label}>{activeLabel}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  starBtn: {
    minWidth: tokens.spacing.touchTargetMin,
    minHeight: tokens.spacing.touchTargetMin,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.sm,
  },
  label: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
  },
});
