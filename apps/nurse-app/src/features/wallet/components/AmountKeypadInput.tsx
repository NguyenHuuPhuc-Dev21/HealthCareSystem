import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertCircle, X } from 'lucide-react-native';
import { tokens } from '../../../styles/tokens';

export interface AmountKeypadInputProps {
  value: number;
  onChangeAmount: (numericValue: number) => void;
  maxAmount?: number;
  presets?: number[];
  errorMessage?: string | null;
  hintText?: string;
  testID?: string;
}

/**
 * Format integer amount to Vietnamese thousand dot notation (e.g. 1000000 -> 1.000.000)
 */
export function formatThousandsDot(num: number): string {
  if (!num || isNaN(num)) return '';
  return num.toLocaleString('vi-VN');
}

/**
 * Parse string with potential thousand separators into an integer
 */
export function parseAmount(text: string): number {
  const clean = text.replace(/\D/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

export const AmountKeypadInput: React.FC<AmountKeypadInputProps> = ({
  value,
  onChangeAmount,
  maxAmount = 0,
  presets = [500000, 1000000, 2000000],
  errorMessage,
  hintText,
  testID = 'amount-keypad-input',
}) => {
  const formattedText = value > 0 ? formatThousandsDot(value) : '';

  const handleChangeText = (text: string) => {
    const num = parseAmount(text);
    onChangeAmount(num);
  };

  const handleClear = () => {
    onChangeAmount(0);
  };

  const handleSelectPreset = (amount: number) => {
    onChangeAmount(amount);
  };

  const handleSelectAll = () => {
    if (maxAmount > 0) {
      onChangeAmount(maxAmount);
    }
  };

  const hasError = Boolean(errorMessage);

  return (
    <View style={styles.container} testID={testID}>
      {/* Label and Maximum quick link */}
      <View style={styles.headerRow}>
        <Text style={styles.label}>
          Số tiền muốn rút <Text style={styles.required}>*</Text>
        </Text>
        {maxAmount > 0 && (
          <TouchableOpacity
            onPress={handleSelectAll}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Rút tối đa toàn bộ số dư khả dụng"
            testID={`${testID}-all-btn`}
          >
            <Text style={styles.selectAllText}>Rút tối đa</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Large Input Display with Auto Thousand Dot */}
      <View
        style={[
          styles.inputWrapper,
          hasError && styles.inputWrapperError,
        ]}
      >
        <TextInput
          style={styles.textInput}
          keyboardType="numeric"
          value={formattedText}
          onChangeText={handleChangeText}
          placeholder="0"
          placeholderTextColor={tokens.colors.inkMuted}
          accessibilityLabel="Số tiền muốn rút"
          accessibilityHint="Nhập số tiền bằng số nguyên VND"
          testID={`${testID}-text-input`}
          maxLength={15}
        />
        <Text style={styles.currencySuffix}>đ</Text>

        {value > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClear}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Xóa số tiền đã nhập"
            testID={`${testID}-clear-btn`}
          >
            <X size={18} color={tokens.colors.inkSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Error or Hint message */}
      {hasError ? (
        <View style={styles.errorRow} testID={`${testID}-error`}>
          <AlertCircle size={15} color={tokens.colors.alertCrimson} style={styles.errorIcon} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : hintText ? (
        <Text style={styles.hintText}>{hintText}</Text>
      ) : null}

      {/* Quick selection chips */}
      <View style={styles.presetsRow}>
        {presets.map((preset) => {
          const isSelected = value === preset;
          return (
            <TouchableOpacity
              key={preset}
              style={[
                styles.presetChip,
                isSelected && styles.presetChipSelected,
              ]}
              onPress={() => handleSelectPreset(preset)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Chọn số tiền ${formatThousandsDot(preset)} đồng`}
              testID={`${testID}-preset-${preset}`}
            >
              <Text
                style={[
                  styles.presetChipText,
                  isSelected && styles.presetChipTextSelected,
                ]}
              >
                {formatThousandsDot(preset)}đ
              </Text>
            </TouchableOpacity>
          );
        })}

        {maxAmount > 0 && (
          <TouchableOpacity
            style={[
              styles.presetChip,
              styles.presetChipAll,
              value === maxAmount && styles.presetChipSelected,
            ]}
            onPress={handleSelectAll}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Chọn tất cả số dư"
            testID={`${testID}-preset-all`}
          >
            <Text
              style={[
                styles.presetChipText,
                styles.presetChipAllText,
                value === maxAmount && styles.presetChipTextSelected,
              ]}
            >
              Tất cả
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: tokens.typography.fontSizeBase,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  required: {
    color: tokens.colors.alertCrimson,
  },
  selectAllText: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.brandJade,
    textDecorationLine: 'underline',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.paper,
    borderWidth: 2,
    borderColor: tokens.colors.borderHairline,
    borderRadius: tokens.radii.md,
    paddingHorizontal: 16,
    height: 64,
  },
  inputWrapperError: {
    borderColor: tokens.colors.alertCrimson,
    backgroundColor: tokens.colors.alertCrimsonSoft,
  },
  textInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: tokens.colors.inkPrimary,
    paddingVertical: 0,
  },
  currencySuffix: {
    fontSize: 24,
    fontWeight: '700',
    color: tokens.colors.inkSecondary,
    marginLeft: 4,
    marginRight: 8,
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: tokens.radii.pill,
    backgroundColor: tokens.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorIcon: {
    marginRight: 6,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.alertCrimson,
    flex: 1,
  },
  hintText: {
    fontSize: 13.5,
    color: tokens.colors.inkSecondary,
    marginTop: 6,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: tokens.radii.pill,
    backgroundColor: tokens.colors.paper,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderHairline,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipSelected: {
    backgroundColor: tokens.colors.brandJadeSoft,
    borderColor: tokens.colors.brandJade,
  },
  presetChipAll: {
    borderColor: tokens.colors.brandJade,
  },
  presetChipText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: tokens.colors.inkPrimary,
  },
  presetChipTextSelected: {
    color: tokens.colors.brandJadeDark,
  },
  presetChipAllText: {
    color: tokens.colors.brandJadeDark,
  },
});
