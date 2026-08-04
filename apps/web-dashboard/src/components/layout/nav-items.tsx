import type { ReactNode } from 'react'

/**
 * Définition unique de la navigation — consommée par la sidebar ET par le tiroir
 * mobile. Deux listes séparées finiraient par diverger.
 */
export interface NavItem {
  to:
    | '/dashboard'
    | '/products'
    | '/categories'
    | '/orders'
    | '/customers'
    | '/statistics'
    | '/billing'
    | '/settings'
  labelKey: string
  icon: ReactNode
  /** Écrans prévus mais non implémentés : visibles, explicitement inactifs. */
  disabled?: boolean
  /**
   * Réservé à l'administrateur. La route reste accessible — c'est le serveur
   * qui tranche — mais l'afficher à un employé lui promettrait un écran qu'il
   * ne peut pas ouvrir.
   */
  adminOnly?: boolean
}

export interface NavSection {
  titleKey: string
  items: NavItem[]
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 } as const

const icons = {
  overview: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
  categories: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M4 6h6v6H4zM14 6h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" strokeLinejoin="round" />
    </svg>
  ),
  products: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z" strokeLinejoin="round" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M6 3h12l1.5 18H4.5z" strokeLinejoin="round" />
      <path d="M9 7a3 3 0 0 0 6 0" />
    </svg>
  ),
  customers: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19a6.2 6.2 0 0 1 12.4 0" strokeLinecap="round" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2M17.5 19a6.2 6.2 0 0 0-1.6-4.2" strokeLinecap="round" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" />
    </svg>
  ),
  billing: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 9.5h19" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" strokeLinecap="round" />
    </svg>
  ),
} as const

export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'nav.section.sell',
    items: [
      { to: '/dashboard', labelKey: 'nav.overview', icon: icons.overview },
      { to: '/products', labelKey: 'nav.products', icon: icons.products },
      { to: '/categories', labelKey: 'nav.categories', icon: icons.categories },
      { to: '/orders', labelKey: 'nav.orders', icon: icons.orders },
      { to: '/customers', labelKey: 'nav.customers', icon: icons.customers },
      { to: '/statistics', labelKey: 'nav.analytics', icon: icons.analytics },
    ],
  },
  {
    titleKey: 'nav.section.account',
    items: [
      { to: '/billing', labelKey: 'nav.billing', icon: icons.billing, adminOnly: true },
      { to: '/settings', labelKey: 'nav.settings', icon: icons.settings },
    ],
  },
]
