import type { OrderStatus } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert } from '@shopnest/ui-web'

/**
 * Progression d'une commande.
 *
 * ⚠️ Ce n'est PAS un historique : les fixtures ne conservent pas les
 * horodatages de chaque transition. On affiche donc l'étape ATTEINTE, déduite
 * du statut courant, sans inventer de dates. Le vrai backend écrit un journal
 * (`payment_events`, doc/03 §6) qui permettra d'afficher les dates réelles.
 */

const FLOW: OrderStatus[] = ['pending', 'paid', 'preparing', 'shipped', 'delivered']

/** États terminaux hors du parcours nominal : la frise n'a plus de sens. */
const TERMINAL: Partial<Record<OrderStatus, 'warning' | 'danger'>> = {
  cancelled: 'warning',
  refunded: 'warning',
  payment_failed: 'danger',
  awaiting_payment: 'warning',
}

export function OrderProgress({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  const terminalVariant = TERMINAL[status]

  if (terminalVariant) {
    return (
      <Alert variant={terminalVariant} title={t(`orders.status.${status}`)}>
        {t(`orders.progress.${status}`)}
      </Alert>
    )
  }

  const currentIndex = FLOW.indexOf(status)

  return (
    <ol className="flex flex-wrap items-center gap-xs" aria-label={t('orders.progress.label')}>
      {FLOW.map((step, index) => {
        const reached = index <= currentIndex
        const isCurrent = index === currentIndex

        return (
          <li key={step} className="flex items-center gap-xs">
            <span
              // La couleur ne porte pas seule l'information : l'étape atteinte
              // affiche une coche, l'étape courante est annoncée par aria-current.
              {...(isCurrent ? { 'aria-current': 'step' as const } : {})}
              className={`flex items-center gap-xs rounded-full px-sm py-xs text-xs font-medium ${
                reached
                  ? 'bg-brand-primarySubtle text-brand-primary'
                  : 'bg-surface-sunken text-text-disabled'
              }`}
            >
              <span aria-hidden="true">{reached ? '✓' : index + 1}</span>
              {t(`orders.status.${step}`)}
            </span>

            {index < FLOW.length - 1 && (
              <span aria-hidden="true" className="text-text-disabled">
                →
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
