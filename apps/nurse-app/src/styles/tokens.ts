/**
 * Elder-Friendly Design Tokens for Nurse Mobile App (React Native)
 * Unified with CareNest Web Clinical Ledger & Warm Precision (SRS §6 NFR-UI-01)
 */
export const tokens = {
  colors: {
    // 6 Core Semantic Tokens
    canvas: '#F5F6F2',
    paper: '#FFFFFF',
    subtle: '#EDF0EB',
    inkPrimary: '#102A24',
    inkSecondary: '#4A635D',
    inkMuted: '#526862',
    brandJade: '#0F6E5B',
    brandJadeDark: '#0B5546',
    brandJadeSoft: '#E6F2EE',
    borderHairline: '#D8E0DC',
    accentOchre: '#B45309',
    accentOchreSoft: '#FEF3C7',
    alertCrimson: '#B91C1C',
    alertCrimsonSoft: '#FEF2F2',

    // Compatibility aliases
    primary: '#0F6E5B',
    primaryDark: '#0B5546',
    background: '#F5F6F2',
    surface: '#FFFFFF',
    textMain: '#102A24',
    textMuted: '#4A635D',
    border: '#D8E0DC',
    error: '#B91C1C',
    success: '#15803D',
    warning: '#B45309',
  },
  typography: {
    fontSizeBase: 17,
    fontSizeLarge: 19,
    fontSizeTitle: 23,
    lineHeightBase: 26,
  },
  spacing: {
    touchTargetMin: 48,
    paddingBase: 16,
  },
  radii: {
    sm: 10,
    md: 14,
    lg: 18,
    pill: 999,
  },
};
