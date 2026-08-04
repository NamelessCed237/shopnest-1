import { cn } from '../lib/cn.js'

/**
 * Jeu d'icônes du produit.
 *
 * POURQUOI PAS D'ÉMOJIS — ils avaient l'avantage de tenir en un caractère, et
 * quatre défauts qui se voient en production :
 *
 *   1. Le dessin appartient au système. 💳 n'a pas la même forme sur Windows,
 *      macOS et Android ; certaines plateformes le rendent en couleur vive au
 *      milieu d'une interface sobre, d'autres en monochrome.
 *   2. Ils ignorent `currentColor`. Impossible de les accorder au thème, ni de
 *      les faire virer au rouge dans un état d'erreur.
 *   3. Leur métrique varie : un émoji décale la ligne de base et désaligne le
 *      texte voisin, ce qui se remarque surtout dans un tableau.
 *   4. Certains manquent purement et simplement sur les systèmes anciens, et
 *      s'affichent en carré vide.
 *
 * Un SVG inline règle les quatre : il hérite de la couleur, s'aligne sur la
 * taille de police et rend la même chose partout.
 *
 * Le trait est unifié (1,7) et les icônes sont dessinées sur une grille de 24 :
 * mélanger des épaisseurs ou des grilles est ce qui fait qu'un jeu d'icônes a
 * l'air emprunté à trois bibliothèques différentes.
 */

const PATHS = {
  // Navigation
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-up': <path d="m6 15 6-6 6 6" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'arrow-left': <path d="M19 12H5m0 0 6-6m-6 6 6 6" />,
  'arrow-right': <path d="M5 12h14m0 0-6-6m6 6-6 6" />,

  // États
  check: <path d="m5 13 4 4L19 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  lock: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),

  // Tri de tableau
  sort: <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  'sort-asc': <path d="m6 14 6-6 6 6" />,
  'sort-desc': <path d="m6 10 6 6 6-6" />,

  // Champs
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M10.6 6.1A9.3 9.3 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.7M6.5 8.3A17 17 0 0 0 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3.4-.65" />
      <path d="m3 3 18 18" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),

  // Thème
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.1 5.1l1.4 1.4M17.5 17.5l1.4 1.4M18.9 5.1l-1.4 1.4M6.5 17.5l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  monitor: (
    <>
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </>
  ),

  // Paiement
  'credit-card': (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 9.5h19" />
    </>
  ),
  smartphone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </>
  ),
  bank: (
    <>
      <path d="m3 9.5 9-5.5 9 5.5" />
      <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18" />
    </>
  ),

  // Commerce
  heart: <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8.2a4.1 4.1 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20Z" />,
  star: <path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8Z" />,
  store: (
    <>
      <path d="M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5" />
      <path d="M3 5h18l-1 4.5H4Z" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2" />
      <path d="M6.5 6.5 7.5 20h9l1-13.5" />
    </>
  ),
  pencil: <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2M17.5 19a6.2 6.2 0 0 0-1.6-4.2" />
    </>
  ),
  shield: <path d="M12 3.5 5 6v6c0 4.2 3 7.4 7 8.5 4-1.1 7-4.3 7-8.5V6Z" />,
} as const

export type IconName = keyof typeof PATHS

export interface IconProps {
  name: IconName
  /** Suit la taille de police par défaut ; `md` couvre la quasi-totalité des cas. */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Étiquette pour les lecteurs d'écran.
   *
   * ABSENTE PAR DÉFAUT, et c'est voulu : la plupart des icônes accompagnent un
   * texte qui dit déjà la même chose, et l'annoncer deux fois alourdit la
   * lecture. Ne la fournir que lorsque l'icône EST la seule information.
   */
  label?: string
  /** Remplit la forme au lieu de la tracer — cœur ou étoile « actifs ». */
  filled?: boolean
}

const SIZE = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' } as const

export function Icon({ name, size = 'md', label, filled = false }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('shrink-0', SIZE[size])}
      // `currentColor` : l'icône prend la couleur du texte qui l'entoure, donc
      // suit le thème et les états (erreur, désactivé) sans une ligne de plus.
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
