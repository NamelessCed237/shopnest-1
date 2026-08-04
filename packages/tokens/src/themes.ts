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
    /*
     * PAS de blanc pur, et pour la raison exacte qui fait éviter le noir pur en
     * mode sombre (voir plus bas) : sur un écran lumineux, une grande étendue de
     * #FFFFFF renvoie toute la luminosité de la dalle et fatigue en lecture
     * prolongée. Un dashboard reste ouvert la journée, ce n'est pas une page
     * qu'on parcourt trente secondes.
     *
     * L'ÉCHELLE est celle de l'application, à ne pas inverser :
     *   · `base`   — les cartes et panneaux, la surface la plus claire ;
     *   · `raised` — le fond de page derrière les cartes (AppShell) ;
     *   · `sunken` — les creux : pistes de jauge, squelettes de chargement.
     *
     * Le fond de page est donc PLUS SOMBRE que les cartes, ce qui les détache.
     * Il est ici assombri d'un cran par rapport à l'ancien #F8FAFC : c'est la
     * plus grande étendue de l'écran, donc celle qui pèse le plus dans la
     * sensation d'éblouissement.
     */
    base: '#FCFDFE',
    raised: '#EFF3F7',
    sunken: '#E2E8F0',
    overlay: 'rgba(15, 23, 42, 0.55)',
  },
  border: {
    base: '#DDE3EA',
    strong: '#94A3B8',
    focus: '#10B981',
  },
  text: {
    /*
     * Ardoise très sombre plutôt que quasi-noir : #0F172A sur blanc pur donnait
     * ~17,8:1, bien au-delà des 7:1 exigés par le niveau AAA. Ce n'est pas un
     * gain de lisibilité, c'est un excès de contraste — celui qui fait
     * « vibrer » le texte et fatigue l'œil.
     *
     * Le couple retenu tient ~14:1 sur une carte : toujours AAA, sans la
     * dureté.
     */
    primary: '#1E293B',
    secondary: '#4A5A70',
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
