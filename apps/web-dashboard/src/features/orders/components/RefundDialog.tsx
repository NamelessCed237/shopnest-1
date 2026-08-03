import { useEffect, useState } from 'react'
import type { AppError, Order } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Modal, TextInput } from '@shopnest/ui-web'
import { useRefundOrder } from '../api/use-order-mutations'

export interface RefundDialogProps {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RefundDialog({ order, open, onOpenChange }: RefundDialogProps) {
  const { t, money } = useTranslation()
  const refund = useRefundOrder(order.id)

  const alreadyRefunded = order.refundedAmount?.amountCents ?? 0
  const remainingCents = order.total.amountCents - alreadyRefunded

  const [amount, setAmount] = useState(String(remainingCents))
  const [reason, setReason] = useState('')

  /*
   * Réinitialisation à chaque OUVERTURE.
   *
   * Le composant reste monté quand la modale est fermée : sans ce recalage,
   * un second remboursement rouvre le formulaire avec le montant de la fois
   * précédente — soit un montant devenu faux depuis le premier remboursement.
   */
  useEffect(() => {
    if (!open) return
    setAmount(String(remainingCents))
    setReason('')
    refund.reset()
    // `refund` change d'identité à chaque rendu : on ne réagit qu'à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, remainingCents])

  const amountCents = Number(amount)
  const amountError =
    !Number.isInteger(amountCents) || amountCents <= 0
      ? t('orders.errors.refundInvalid')
      : amountCents > remainingCents
        ? t('orders.errors.refundTooLarge')
        : undefined

  const canSubmit = !amountError && reason.trim().length > 0 && !refund.isPending

  const handleSubmit = () => {
    if (!canSubmit) return
    refund.mutate(
      { amountCents, reason: reason.trim() },
      {
        // La réinitialisation se fait à la réouverture : la remettre ici
        // ferait clignoter le formulaire pendant la fermeture.
        onSuccess: () => onOpenChange(false),
      },
    )
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('orders.actions.refund')}
      description={t('orders.refund.description', { reference: order.reference })}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={refund.isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={handleSubmit} loading={refund.isPending} disabled={!canSubmit}>
            {t('orders.refund.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        {refund.error && (
          <Alert variant="danger" traceId={traceIdOf(refund.error)}>
            {t(refund.error.userMessageKey)}
          </Alert>
        )}

        <dl className="flex flex-col gap-xs rounded-md bg-surface-raised p-sm text-sm">
          <Row label={t('orders.columns.total')} value={money(order.total)} />
          {alreadyRefunded > 0 && (
            <Row
              label={t('orders.refund.alreadyRefunded')}
              value={money({ amountCents: alreadyRefunded, currency: order.total.currency })}
            />
          )}
          <Row
            label={t('orders.refund.remaining')}
            value={money({ amountCents: remainingCents, currency: order.total.currency })}
            strong
          />
        </dl>

        {/*
          Saisie en unités mineures, comme le contrat : le XAF n'a pas de
          décimale, un champ « en euros » produirait un facteur 100 selon la
          devise du tenant (doc/03 §4).
        */}
        <TextInput
          label={t('orders.refund.amountLabel', { currency: order.total.currency })}
          type="number"
          inputMode="numeric"
          min={1}
          max={remainingCents}
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={amountError}
          helperText={t('orders.refund.amountHint')}
        />

        <TextInput
          label={t('orders.refund.reasonLabel')}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t('orders.refund.reasonPlaceholder')}
          helperText={t('orders.refund.reasonHint')}
        />

        {amountCents === remainingCents && (
          <Alert variant="warning">{t('orders.refund.fullWarning')}</Alert>
        )}
      </div>
    </Modal>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-md">
      <dt className="text-text-secondary">{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-semibold text-text-primary' : 'text-text-primary'}`}>
        {value}
      </dd>
    </div>
  )
}

const traceIdOf = (error: AppError) => (error.code === 'INTERNAL' ? error.traceId : undefined)
