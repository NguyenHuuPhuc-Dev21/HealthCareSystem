import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { tokens } from '../styles/tokens';

export interface CareNestLogoMarkProps {
  size?: number;
  variant?: 'solid' | 'bare';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * CareNest official logo mark glyph (docs/design/logo/carenest-icon.svg).
 * Consists of a rounded green tile (#175346), house roof chevron,
 * heart/cradle hands, and clinical cross in mint (#7FC8B5).
 */
export const CareNestLogoMark: React.FC<CareNestLogoMarkProps> = ({
  size = 44,
  variant = 'solid',
  style,
  testID = 'carenest-logo-mark',
}) => {
  const borderRadius = Math.round(size * 0.24);

  return (
    <View
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel="Logo CareNest"
      style={[
        styles.markBox,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: variant === 'solid' ? '#175346' : 'transparent',
        },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        {/* House roof chevron */}
        <Path
          d="M13 28.5 L32 13 L51 28.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={4.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Hands / cradle arc */}
        <Path
          d="M18.5 37.5 Q32 48.5 45.5 37.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={4.2}
          strokeLinecap="round"
        />
        {/* Clinical cross */}
        <Rect x="29.5" y="19.5" width="5" height="14.5" fill="#7FC8B5" rx="0.8" />
        <Rect x="24.8" y="24.2" width="14.4" height="5" fill="#7FC8B5" rx="0.8" />
      </Svg>
    </View>
  );
};

export interface CareNestLogoProps {
  size?: number;
  variant?: 'solid' | 'bare';
  layout?: 'vertical' | 'horizontal';
  showTagline?: boolean;
  showRoleBadge?: boolean;
  roleText?: string;
  brandName?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

/**
 * CareNest full brand lockup: LogoMark + Name + Tagline/RoleBadge.
 * Synchronized with nurse-web, admin-web, and landing specifications.
 */
export const CareNestLogo: React.FC<CareNestLogoProps> = ({
  size = 48,
  variant = 'solid',
  layout = 'vertical',
  showTagline = false,
  showRoleBadge = false,
  roleText = 'CỔNG ĐIỀU DƯỠNG VIÊN',
  brandName = 'CareNest',
  textColor = tokens.colors.inkPrimary,
  style,
  textStyle,
  testID = 'carenest-logo',
}) => {
  const isHorizontal = layout === 'horizontal';

  return (
    <View
      testID={testID}
      style={[
        isHorizontal ? styles.containerHorizontal : styles.containerVertical,
        style,
      ]}
    >
      <CareNestLogoMark size={size} variant={variant} />

      <View
        style={[
          isHorizontal ? styles.textWrapHorizontal : styles.textWrapVertical,
        ]}
      >
        <Text
          style={[
            styles.brandName,
            { color: textColor, fontSize: isHorizontal ? Math.max(18, Math.round(size * 0.55)) : 24 },
            textStyle,
          ]}
        >
          {brandName}
        </Text>

        {showTagline && (
          <Text style={styles.tagline}>YOUR HOME, OUR CARE</Text>
        )}

        {showRoleBadge && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleText}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  markBox: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  containerVertical: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textWrapVertical: {
    alignItems: 'center',
    marginTop: 10,
  },
  textWrapHorizontal: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  brandName: {
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  tagline: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: tokens.colors.inkSecondary,
    marginTop: 3,
  },
  roleBadge: {
    marginTop: 8,
    backgroundColor: tokens.colors.brandJadeSoft,
    borderWidth: 1,
    borderColor: tokens.colors.brandJade,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: tokens.radii.pill,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: tokens.colors.brandJadeDark,
  },
});
