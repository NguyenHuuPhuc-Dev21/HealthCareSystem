/**
 * Elder-Friendly Design Tokens for Nurse Mobile App (React Native)
 * SRS §6 NFR-UI-01: Font size 16pt–18pt, Touch target >= 48x48 dp, WCAG 2.1 AA
 */
export const tokens = {
  colors: {
    primary: '#0d9488',
    primaryDark: '#0f766e',
    background: '#ffffff',
    surface: '#f0fdfa',
    textMain: '#0f172a',
    textMuted: '#334155',
    border: '#cbd5e1',
    error: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
  },
  typography: {
    fontSizeBase: 16,
    fontSizeLarge: 18,
    fontSizeTitle: 22,
    lineHeightBase: 24,
  },
  spacing: {
    touchTargetMin: 48,
    paddingBase: 16,
  },
};

