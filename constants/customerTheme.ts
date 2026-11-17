import { colors } from './colors';

/**
 * Customer-side modern neutral surface + yellow brand accent palette.
 * Neutral White (#FFFFFF) cards over WhiteSmoke (#F5F5F5) canvas keep food imagery
 * crisp and true-to-life, while #FFCC00 acts as a focused brand accent for CTAs
 * and active states.
 */
export const customerTheme = {
  bg: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F4F6',
  border: '#E5E7EB',
  divider: '#EFEFEF',
  accent: '#FFCC00',
  ink: '#18181B',
  muted: '#6B7280',

  // Shades & tints of #FFCC00
  accentDark: '#E0AE00',
  accentText: '#997300',
  accentSoft: '#FEF9E7',
  accentSoftAlt: '#FEF08A',
  accentBorder: '#F2C94C',

  // Standardized food-app corner radius scale
  radius: {
    hero: 16,
    card: 14,
    inner: 10,
    chip: 8,
    pill: 999,
  },
};

export const customerColors = {
  ...colors,
  primary: customerTheme.accent,
  primaryDark: customerTheme.accentDark,
  primaryLight: customerTheme.accentSoftAlt,
  primarySoft: customerTheme.accentSoft,
  primaryText: customerTheme.accentText,
  primaryBorder: customerTheme.accentBorder,
  onPrimary: customerTheme.ink,
  background: customerTheme.bg,
  surface: customerTheme.surface,
  surfaceMuted: customerTheme.surfaceMuted,
  border: customerTheme.border,
  divider: customerTheme.divider,
  textPrimary: customerTheme.ink,
  muted: customerTheme.muted,
  radius: customerTheme.radius,
  food: customerTheme.accent,
  dessert: '#FFE066',
};

export default customerTheme;
