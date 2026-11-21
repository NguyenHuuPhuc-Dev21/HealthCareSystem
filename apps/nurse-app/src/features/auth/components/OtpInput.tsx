import React, { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { tokens } from '../../../styles/tokens';

export interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  length = 6,
  disabled = false,
  hasError = false,
  autoFocus = true,
}) => {
  const inputRef = useRef<TextInput>(null);

  const handlePress = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const digits = value.split('').slice(0, length);
  const boxes = Array.from({ length }, (_, i) => digits[i] || '');

  return (
    <Pressable
      onPress={handlePress}
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={`Mã OTP 6 chữ số: ${value || 'chưa nhập'}`}
    >
      {/* Hidden input taking advantage of OS SMS auto-fill and paste */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => {
          const sanitized = text.replace(/[^0-9]/g, '').slice(0, length);
          onChange(sanitized);
        }}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        editable={!disabled}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        style={styles.hiddenInput}
        caretHidden
        testID="otp-hidden-input"
      />

      <View style={styles.boxesRow}>
        {boxes.map((digit, index) => {
          const isFocused = !disabled && (index === value.length || (index === length - 1 && value.length === length));
          const isFilled = Boolean(digit);

          return (
            <View
              key={index}
              style={[
                styles.box,
                isFilled && styles.boxFilled,
                isFocused && styles.boxFocused,
                hasError && styles.boxError,
                disabled && styles.boxDisabled,
              ]}
            >
              <Text
                style={[
                  styles.digit,
                  hasError && styles.digitError,
                  disabled && styles.digitDisabled,
                ]}
              >
                {digit}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.01,
  },
  boxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 340,
    gap: 8,
  },
  box: {
    flex: 1,
    height: 56,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.paper,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    borderColor: tokens.colors.inkSecondary,
    backgroundColor: tokens.colors.subtle,
  },
  boxFocused: {
    borderColor: tokens.colors.brandJade,
    borderWidth: 2,
    backgroundColor: tokens.colors.paper,
  },
  boxError: {
    borderColor: tokens.colors.alertCrimson,
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  boxDisabled: {
    opacity: 0.6,
    backgroundColor: tokens.colors.subtle,
  },
  digit: {
    fontSize: 24,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  digitError: {
    color: tokens.colors.alertCrimson,
  },
  digitDisabled: {
    color: tokens.colors.inkMuted,
  },
});
