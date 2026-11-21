import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { JobBoardFilter } from '@healthcare-system/shared';
import { tokens } from '../../../styles/tokens';

export interface FilterChipsProps {
  activeFilter: JobBoardFilter;
  onSelectFilter: (filter: JobBoardFilter) => void;
}

interface FilterOption {
  key: JobBoardFilter;
  label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'shift', label: 'Theo ca' },
  { key: 'task', label: 'Thủ thuật' },
  { key: 'near', label: 'Gần tôi' },
  { key: 'bonus', label: 'Có thưởng' },
];

export const FilterChips: React.FC<FilterChipsProps> = ({
  activeFilter,
  onSelectFilter,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {FILTER_OPTIONS.map((option) => {
          const isActive = activeFilter === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onSelectFilter(option.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Bộ lọc ${option.label}`}
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    backgroundColor: tokens.colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: tokens.colors.paper,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: tokens.colors.brandJade,
    borderColor: tokens.colors.brandJade,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.inkSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
