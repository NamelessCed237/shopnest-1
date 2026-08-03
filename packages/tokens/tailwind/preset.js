import { spacing, radius, fontSize, fontWeight, duration, zIndex } from '@shopnest/tokens'

/**
 * doc/02 §6 — aucune valeur visuelle en dur.
 *
 * Les couleurs pointent vers les variables CSS générées (`css/theme.css`) et non
 * vers des hex figés : c'est ce qui permet au mode sombre de basculer sans
 * qu'aucun composant ne change. La forme `rgb(var(--x) / <alpha-value>)`
 * préserve les modificateurs d'opacité de Tailwind (`bg-surface-base/95`).
 */
const color = (name) => `rgb(var(--color-${name}) / <alpha-value>)`

const toRem = (scale) =>
  Object.fromEntries(
    Object.entries(scale).map(([k, v]) => [k, typeof v === 'number' ? `${v / 16}rem` : v]),
  )

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: color('brand-primary'),
          primaryHover: color('brand-primaryHover'),
          primarySubtle: color('brand-primarySubtle'),
          onPrimary: color('brand-onPrimary'),
        },
        surface: {
          base: color('surface-base'),
          raised: color('surface-raised'),
          sunken: color('surface-sunken'),
          // L'overlay porte déjà son alpha : pas de modificateur d'opacité.
          overlay: 'var(--color-surface-overlay-raw)',
        },
        border: {
          base: color('border-base'),
          strong: color('border-strong'),
          focus: color('border-focus'),
        },
        text: {
          primary: color('text-primary'),
          secondary: color('text-secondary'),
          disabled: color('text-disabled'),
          inverse: color('text-inverse'),
        },
        status: {
          success: color('status-success'),
          warning: color('status-warning'),
          danger: color('status-danger'),
          info: color('status-info'),
        },
      },
      spacing: toRem(spacing),
      borderRadius: toRem(radius),
      fontSize: toRem(fontSize),
      fontWeight,
      zIndex,
      transitionDuration: Object.fromEntries(
        Object.entries(duration).map(([k, v]) => [k, `${v}ms`]),
      ),
    },
  },
}
