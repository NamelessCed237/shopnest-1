import type { Config } from 'tailwindcss'
import preset from '@shopnest/tokens/tailwind/preset'

/** doc/02 §6 — aucune valeur en dur ici : tout vient de @shopnest/tokens via le preset. */
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui-web/src/**/*.{ts,tsx}'],
} satisfies Config
