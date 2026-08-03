import type { ReactNode } from 'react'
import { useTranslation } from '@shopnest/i18n/react'

/**
 * Les trois arguments de réassurance. Le premier n'est pas décoratif : le
 * paiement Mobile Money est LE différenciateur de la plateforme (cahier des
 * charges §4.3), il doit être visible sans défilement sur mobile.
 */
const ITEMS = ['payments', 'delivery', 'support'] as const

export function ValueProps() {
  const { t } = useTranslation()

  return (
    <section>
      {/*
        Titre réel plutôt qu'un simple aria-label : sans lui, la page passe de
        H1 à H3 et un lecteur d'écran qui navigue par titres saute la section.
        Il est masqué visuellement parce que la maquette ne le montre pas.
      */}
      <h2 className="sr-only">{t('storefront.valueProps.title')}</h2>

      <ul className="grid gap-md md:grid-cols-3">
        {ITEMS.map((item) => (
          <li
            key={item}
            className="flex gap-sm rounded-lg border border-border-base bg-surface-base p-md"
          >
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-primary text-brand-onPrimary"
            >
              {ICONS[item]}
            </span>

            <div className="flex flex-col gap-xs">
              <h3 className="text-sm font-semibold text-text-primary">
                {t(`storefront.valueProps.${item}.title`)}
              </h3>
              <p className="text-xs leading-relaxed text-text-secondary">
                {t(`storefront.valueProps.${item}.body`)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 } as const

const ICONS: Record<(typeof ITEMS)[number], ReactNode> = {
  payments: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19" />
    </svg>
  ),
  delivery: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M2.5 7.5h11v9h-11z" />
      <path d="M13.5 11h4l3 3v2.5h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M4 13a8 8 0 0 1 16 0" />
      <rect x="2.5" y="13" width="4" height="6" rx="1.5" />
      <rect x="17.5" y="13" width="4" height="6" rx="1.5" />
    </svg>
  ),
}
