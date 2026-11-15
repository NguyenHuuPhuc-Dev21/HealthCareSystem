import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { tokens } from '../styles/tokens';

export type AppButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const AppButton: React.FC<AppButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
  testID,
}) => {
  const isDisabled = disabled || loading;

  const containerVariant =
    variant === 'secondary'
      ? styles.secondary
      : variant === 'danger'
      ? styles.danger
      : variant === 'ghost'
      ? styles.ghost
      : styles.primary;

  const textVariant =
    variant === 'secondary' || variant === 'ghost' ? styles.textDark : styles.textLight;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        containerVariant,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' || variant === 'ghost' ? tokens.colors.brandJade : '#FFFFFF'}
        />
      ) : (
        <Text style={[styles.textBase, textVariant]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: tokens.spacing.touchTargetMin,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: tokens.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: tokens.colors.brandJade,
  },
  secondary: {
    backgroundColor: tokens.colors.paper,
    borderWidth: 1.5,
    borderColor: tokens.colors.brandJade,
  },
  danger: {
    backgroundColor: tokens.colors.alertCrimson,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.52,
  },
  textBase: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  textLight: {
    color: '#FFFFFF',
  },
  textDark: {
    color: tokens.colors.brandJade,
  },
});

