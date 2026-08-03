/**
 * Design tokens — doc/06 §5.
 *
 * Valeurs JS plateforme-agnostiques : consommées par la config Tailwind (web)
 * et directement par les styles React Native (mobile).
 *
 * Les noms sont SÉMANTIQUES (`text.secondary`), jamais descriptifs (`gray500`) :
 * c'est ce qui permet le mode sombre et le thème par tenant sans toucher aux composants.
 */

export * from './themes.js'
import { lightTheme } from './themes.js'

/**
 * Couleurs par défaut (mode clair) — pour React Native et tout consommateur
 * qui n'a pas de variables CSS. Le web passe par le preset Tailwind, qui lit
 * les variables générées et bascule donc automatiquement en mode sombre.
 */
export const colors = lightTheme

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
