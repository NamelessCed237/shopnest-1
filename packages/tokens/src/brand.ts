import type { ThemeMode } from './themes.js'

/**
 * Dérivation d'une palette de marque à partir d'UNE seule couleur.
 *
 * Le vendeur — ou le super-admin qui configure sa boutique — choisit une
 * couleur, pas quatre. Lui demander séparément la teinte de survol, le fond
 * discret et la couleur du texte posé dessus produirait à coup sûr des
 * combinaisons illisibles : c'est précisément le genre de réglage dont personne
 * ne vérifie le contraste.
 *
 * Les quatre valeurs sont donc CALCULÉES, et `onPrimary` est choisie pour le
 * contraste, jamais par goût.
 */

export interface BrandPalette {
  primary: string
  primaryHover: string
  primarySubtle: string
  onPrimary: string
}

const HEX = /^#([0-9a-f]{6})$/i

export function isHexColor(value: string): boolean {
  return HEX.test(value)
}

export function hexToRgb(hex: string): [number, number, number] {
  const match = HEX.exec(hex)
  if (!match) throw new Error(`Couleur hexadécimale invalide : ${hex}`)
  const int = Number.parseInt(match[1]!, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

const toHex = (channel: number): string =>
  Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')

export const rgbToHex = (r: number, g: number, b: number): string =>
  `#${toHex(r)}${toHex(g)}${toHex(b)}`

/**
 * Luminance relative (WCAG 2.1).
 *
 * Ce n'est PAS la moyenne des canaux : l'œil est bien plus sensible au vert
 * qu'au bleu, et une moyenne naïve déclarerait un bleu vif « clair » alors
 * qu'il réclame du texte blanc.
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (light! + 0.05) / (dark! + 0.05)
}

const mix = (hex: string, target: [number, number, number], amount: number): string => {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    r + (target[0] - r) * amount,
    g + (target[1] - g) * amount,
    b + (target[2] - b) * amount,
  )
}

const BLACK: [number, number, number] = [0, 0, 0]
const WHITE: [number, number, number] = [255, 255, 255]

/**
 * @param primary couleur choisie, en `#rrggbb`
 * @param mode le fond sur lequel la palette sera posée
 */
export function deriveBrandPalette(primary: string, mode: ThemeMode = 'light'): BrandPalette {
  if (!isHexColor(primary)) throw new Error(`Couleur hexadécimale invalide : ${primary}`)

  return {
    primary,

    /*
     * Le survol s'ASSOMBRIT en mode clair et s'ÉCLAIRCIT en mode sombre.
     *
     * Assombrir dans les deux cas — le réflexe — rendrait le survol moins
     * visible que l'état normal sur fond sombre : le bouton semblerait
     * s'éteindre au passage de la souris.
     */
    primaryHover: mode === 'light' ? mix(primary, BLACK, 0.18) : mix(primary, WHITE, 0.2),

    /* Fond discret : la même teinte, presque entièrement fondue dans la surface. */
    primarySubtle: mode === 'light' ? mix(primary, WHITE, 0.92) : mix(primary, BLACK, 0.78),

    /*
     * Blanc ou noir, selon celui qui contraste le mieux AVEC la couleur choisie.
     *
     * Forcer du blanc — ce que font la plupart des thèmes configurables — rend
     * illisible tout bouton d'une couleur claire : un jaune de marque avec du
     * texte blanc tombe sous 2:1. On compare les deux et on garde le meilleur.
     */
    onPrimary: contrastRatio(primary, '#ffffff') >= contrastRatio(primary, '#111111')
      ? '#ffffff'
      : '#111111',
  }
}

/**
 * Palette → variables CSS, au format triplet attendu par le préréglage Tailwind
 * (`rgb(var(--x) / <alpha-value>)`).
 *
 * Renvoie un objet et non une chaîne de style : l'appelant décide s'il l'écrit
 * dans un attribut `style` (portée locale) ou sur `:root` (portée globale).
 */
export function brandPaletteToCssVars(palette: BrandPalette): Record<string, string> {
  return {
    '--color-brand-primary': hexToRgb(palette.primary).join(' '),
    '--color-brand-primaryHover': hexToRgb(palette.primaryHover).join(' '),
    '--color-brand-primarySubtle': hexToRgb(palette.primarySubtle).join(' '),
    '--color-brand-onPrimary': hexToRgb(palette.onPrimary).join(' '),
  }
}
