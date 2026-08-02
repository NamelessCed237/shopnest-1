import { colors, spacing, radius, fontSize, fontWeight, duration } from '@shopnest/tokens'

/**
 * doc/02 §6 — aucune valeur visuelle en dur.
 * Tailwind est alimenté par @shopnest/tokens, jamais par des littéraux.
 */
const toRem = (scale) =>
  Object.fromEntries(
    Object.entries(scale).map(([k, v]) => [k, typeof v === 'number' ? `${v / 16}rem` : v]),
  )

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors,
      spacing: toRem(spacing),
      borderRadius: toRem(radius),
      fontSize: toRem(fontSize),
      fontWeight,
      transitionDuration: Object.fromEntries(
        Object.entries(duration).map(([k, v]) => [k, `${v}ms`]),
      ),
    },
  },
}
