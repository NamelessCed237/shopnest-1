import type { Order, PaymentStatus } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Badge, Card } from '@shopnest/ui-web'
import { PaymentMethodLabel } from './PaymentMethodLabel'

const STATUS_VARIANT = {
  pending: 'neutral',
  awaiting_confirmation: 'warning',
  settled: 'success',
  failed: 'danger',
  expired: 'warning',
  refunded: 'warning',
} as const satisfies Record<PaymentStatus, 'neutral' | 'warning' | 'success' | 'danger'>

export function OrderPaymentCard({ order }: { order: Order }) {
  const { t, money, date } = useTranslation()
  const payment = order.payment

  if (!payment) {
    return (
      <Card title={t('orders.detail.payment')}>
        <p className="text-sm text-text-secondary">{t('orders.detail.noPayment')}</p>
      </Card>
    )
  }

  return (
    <Card title={t('orders.detail.payment')}>
      <dl className="flex flex-col gap-sm text-sm">
        {/* « Moyen de paiement » et non « Paiement » : la carte porte déjà ce
            titre, et répéter le mot ne dit pas ce que contient la ligne. */}
        <Row label={t('orders.filters.paymentMethod')}>
          <PaymentMethodLabel payment={payment} />
        </Row>

        <Row label={t('orders.detail.paymentStatus')}>
          <Badge variant={STATUS_VARIANT[payment.status]}>
            {t(`orders.paymentStatus.${payment.status}`)}
          </Badge>
        </Row>

        <Row label={t('orders.detail.provider')}>
          <span className="text-text-primary">{payment.provider}</span>
        </Row>

        <Row label={t('orders.detail.amount')}>
          <span className="tabular-nums text-text-primary">{money(payment.amount)}</span>
        </Row>

        {payment.externalId && (
          <Row label={t('orders.detail.externalId')}>
            <span className="break-all font-mono text-xs text-text-secondary">
              {payment.externalId}
            </span>
          </Row>
        )}
      </dl>

      {/*
        Mobile Money est asynchrone : l'acheteur valide sur son téléphone et le
        paiement peut expirer (doc/03 §6). Le vendeur doit voir l'échéance,
        sinon il relance un client dont la demande est simplement en cours.
      */}
      {payment.status === 'awaiting_confirmation' && (
        <div className="mt-md">
          <Alert variant="warning" title={t('orders.payment.awaitingConfirmation')}>
            {payment.expiresAt
              ? t('orders.detail.expiresAt', { date: date(payment.expiresAt) })
              : t('orders.detail.awaitingHint')}
          </Alert>
        </div>
      )}
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-md">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-end">{children}</dd>
    </div>
  )
}
