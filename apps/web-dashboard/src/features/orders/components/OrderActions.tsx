import { useState } from 'react'
import {
  ORDER_TRANSITIONS,
  REFUNDABLE_STATUSES,
  type Order,
  type OrderStatus,
} from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Modal } from '@shopnest/ui-web'
import { useUpdateOrderStatus } from '../api/use-order-mutations'
import { RefundDialog } from './RefundDialog'

/**
 * doc §10.2 — actions de traitement.
 *
 * Les boutons proposés sont DÉDUITS de `ORDER_TRANSITIONS` : ajouter un statut
 * au contrat suffit à le voir apparaître ici, et aucune action affichée ne peut
 * être refusée par le serveur.
 */

/** Transitions destructives : on demande confirmation avant, pas après. */
const NEEDS_CONFIRMATION: readonly OrderStatus[] = ['cancelled']

export function OrderActions({ order, onPrintInvoice }: { order: Order; onPrintInvoice: () => void }) {
  const { t } = useTranslation()
  const updateStatus = useUpdateOrderStatus(order.id)

  const [pendingStatus, setPendingStatus] = useState<OrderStatus | undefined>()
  const [refundOpen, setRefundOpen] = useState(false)

  // Un remboursement n'est PAS une transition de statut : il passe par son
  // propre endpoint, on le retire donc de la liste des boutons de progression.
  const transitions = ORDER_TRANSITIONS[order.status].filter((status) => status !== 'refunded')

  const alreadyRefunded = order.refundedAmount?.amountCents ?? 0
  const canRefund =
    REFUNDABLE_STATUSES.includes(order.status) && alreadyRefunded < order.total.amountCents

  const apply = (status: OrderStatus) => {
    if (NEEDS_CONFIRMATION.includes(status)) {
      setPendingStatus(status)
      return
    }
    updateStatus.mutate({ status })
  }

  return (
    <div className="flex flex-col items-end gap-sm">
      <div className="flex flex-wrap justify-end gap-sm">
        <Button variant="secondary" onClick={onPrintInvoice}>
          {t('orders.actions.invoice')}
        </Button>

        {canRefund && (
          <Button variant="secondary" onClick={() => setRefundOpen(true)}>
            {t('orders.actions.refund')}
          </Button>
        )}

        {transitions.map((status) => (
          <Button
            key={status}
            variant={status === 'cancelled' ? 'danger' : 'primary'}
            loading={updateStatus.isPending && updateStatus.variables?.status === status}
            // Le bouton reste actif pendant la mutation d'un AUTRE bouton :
            // on ne bloque pas toute la barre pour un seul appel en cours.
            disabled={updateStatus.isPending}
            onClick={() => apply(status)}
          >
            {t(`orders.actions.markAs.${status}`)}
          </Button>
        ))}

        {transitions.length === 0 && !canRefund && (
          <span className="self-center text-sm text-text-secondary">
            {t('orders.actions.noneAvailable')}
          </span>
        )}
      </div>

      {updateStatus.error && (
        <Alert variant="danger">{t(updateStatus.error.userMessageKey)}</Alert>
      )}

      <Modal
        open={pendingStatus !== undefined}
        onOpenChange={(open) => !open && setPendingStatus(undefined)}
        title={t('orders.actions.confirmCancelTitle')}
        description={t('orders.actions.confirmCancelBody', { reference: order.reference })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingStatus(undefined)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={updateStatus.isPending}
              onClick={() => {
                if (!pendingStatus) return
                updateStatus.mutate(
                  { status: pendingStatus },
                  { onSettled: () => setPendingStatus(undefined) },
                )
              }}
            >
              {t('orders.actions.confirmCancel')}
            </Button>
          </>
        }
      >
        <Alert variant="warning">{t('orders.actions.irreversible')}</Alert>
      </Modal>

      <RefundDialog order={order} open={refundOpen} onOpenChange={setRefundOpen} />
    </div>
  )
}
