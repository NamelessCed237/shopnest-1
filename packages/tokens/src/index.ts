/**
 * Design tokens — doc/06 §5.
 *
 * Valeurs JS plateforme-agnostiques : consommées par la config Tailwind (web)
 * et directement par les styles React Native (mobile).
 *
 * Les noms sont SÉMANTIQUES (`text.secondary`), jamais descriptifs (`gray500`) :
 * c'est ce qui permet le mode sombre et le thème par tenant sans toucher aux composants.
 */

export const palette = {
  blue: { 50: '#EFF6FF', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8' },
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    400: '#94A3B8',
    600: '#475569',
    800: '#1E293B',
    900: '#0F172A',
  },
  green: { 500: '#16A34A' },
  amber: { 500: '#D97706' },
  red: { 500: '#DC2626' },
  cyan: { 500: '#0284C7' },
  white: '#FFFFFF',
} as const

export const colors = {
  brand: {
    primary: palette.blue[600],
    primaryHover: palette.blue[700],
    primarySubtle: palette.blue[50],
    onPrimary: palette.white,
  },
  surface: {
    base: palette.white,
    raised: palette.slate[50],
    sunken: palette.slate[100],
    overlay: 'rgba(15, 23, 42, 0.6)',
  },
  border: {
    base: palette.slate[200],
    strong: palette.slate[400],
    focus: palette.blue[500],
  },
  text: {
    primary: palette.slate[900],
    secondary: palette.slate[600],
    disabled: palette.slate[400],
    inverse: palette.white,
  },
  status: {
    success: palette.green[500],
    warning: palette.amber[500],
    danger: palette.red[500],
    info: palette.cyan[500],
  },
} as const

/** Échelle d'espacement en pixels — convertie en rem côté web par le preset Tailwind. */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const

export const radius = { none: 0, sm: 4, md: 8, lg: 16, xl: 24, full: 9999 } as const

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
} as const

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const

export const duration = { fast: 150, normal: 250, slow: 400 } as const

export const zIndex = { base: 0, dropdown: 1000, overlay: 1100, modal: 1200, toast: 1300 } as const

/** Cibles tactiles minimales — doc/05 §4. */
export const touchTarget = { min: 44 } as const

export type Colors = typeof colors

/** Même forme que `colors`, mais valeurs élargies en `string` — un thème tenant
 *  fournit des couleurs arbitraires, pas les littéraux par défaut. */
export type ThemedColors = {
  [Group in keyof Colors]: { [Token in keyof Colors[Group]]: string }
}
export type Spacing = keyof typeof spacing
export type Radius = keyof typeof radius
export type FontSize = keyof typeof fontSize

/**
 * Thème par tenant : l'API renvoie une surcharge partielle, fusionnée avec les valeurs
 * par défaut. Même mécanisme sur les deux plateformes.
 */
export interface TenantTheme {
  brandPrimary?: string
  brandPrimaryHover?: string
  radiusScale?: 'sharp' | 'default' | 'rounded'
}

export function applyTenantTheme(theme: TenantTheme): ThemedColors {
  if (!theme.brandPrimary) return colors
  return {
    ...colors,
    brand: {
      ...colors.brand,
      primary: theme.brandPrimary,
      primaryHover: theme.brandPrimaryHover ?? theme.brandPrimary,
    },
  }
}
