/**
 * Thèmes clair et sombre — SOURCE DE VÉRITÉ des couleurs.
 *
 * doc/06 §5 — les noms sont SÉMANTIQUES (`text.secondary`), jamais descriptifs
 * (`gray500`) : c'est ce qui permet d'avoir deux jeux de valeurs pour un seul
 * jeu de composants. Aucun composant ne sait s'il est en clair ou en sombre.
 *
 * Le mode sombre n'est PAS une inversion automatique du mode clair : les
 * surfaces sombres réclament des teintes plus lumineuses et moins saturées pour
 * conserver le contraste sans éblouir. Chaque valeur est choisie, pas calculée.
 */

export interface Theme {
  brand: {
    primary: string
    primaryHover: string
    primarySubtle: string
    onPrimary: string
  }
  surface: {
    base: string
    raised: string
    sunken: string
    overlay: string
  }
  border: {
    base: string
    strong: string
    focus: string
  }
  text: {
    primary: string
    secondary: string
    disabled: string
    inverse: string
  }
  status: {
    success: string
    warning: string
    danger: string
    info: string
  }
}

/** Émeraude & ardoise — mode clair. */
export const lightTheme: Theme = {
  brand: {
    primary: '#047857',
    primaryHover: '#065F46',
    primarySubtle: '#ECFDF5',
    onPrimary: '#FFFFFF',
  },
  surface: {
    base: '#FFFFFF',
    raised: '#F8FAFC',
    sunken: '#EEF2F6',
    overlay: 'rgba(15, 23, 42, 0.55)',
  },
  border: {
    base: '#E2E8F0',
    strong: '#94A3B8',
    focus: '#10B981',
  },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    disabled: '#94A3B8',
    inverse: '#FFFFFF',
  },
  status: {
    success: '#047857',
    warning: '#B45309',
    danger: '#B91C1C',
    info: '#0E7490',
  },
}

/** Émeraude & ardoise — mode sombre, échelonné pour une surface sombre. */
export const darkTheme: Theme = {
  brand: {
    // Plus clair qu'en mode clair : #047857 sur fond sombre passe sous le seuil
    // de contraste et devient illisible.
    primary: '#34D399',
    primaryHover: '#6EE7B7',
    primarySubtle: '#0B3B2E',
    onPrimary: '#04201A',
  },
  surface: {
    // Ardoise, jamais du noir pur : le noir absolu crée un halo autour du texte
    // clair et fatigue à la lecture prolongée.
    base: '#0F172A',
    raised: '#16213A',
    sunken: '#1E293B',
    overlay: 'rgba(2, 6, 23, 0.7)',
  },
  border: {
    base: '#293548',
    strong: '#64748B',
    focus: '#34D399',
  },
  text: {
    // Blanc cassé plutôt que #FFFFFF, pour la même raison.
    primary: '#E9EEF5',
    secondary: '#A3B0C2',
    disabled: '#64748B',
    inverse: '#0F172A',
  },
  status: {
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#38BDF8',
  },
}

export const THEME_MODES = ['light', 'dark'] as const
export type ThemeMode = (typeof THEME_MODES)[number]

export const themes: Record<ThemeMode, Theme> = {
  light: lightTheme,
  dark: darkTheme,
}
