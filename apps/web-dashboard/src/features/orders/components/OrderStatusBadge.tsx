import type { OrderStatus } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Badge } from '@shopnest/ui-web'

/**
 * skill dataviz — les couleurs de statut sont RÉSERVÉES et ne servent jamais de
 * « série 4 ». Elles sont toujours accompagnées du libellé : la couleur seule ne
 * porte aucune information.
 */
const VARIANT = {
  pending: 'neutral',
  awaiting_payment: 'warning',
  paid: 'info',
  preparing: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'neutral',
  refunded: 'warning',
  payment_failed: 'danger',
} as const satisfies Record<OrderStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'>

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  return <Badge variant={VARIANT[status]}>{t(`orders.status.${status}`)}</Badge>
}
