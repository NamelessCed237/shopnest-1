import type { Payment, PaymentMethod } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'

const ICON: Record<PaymentMethod, string> = {
  card: '💳',
  mtn_momo: '📱',
  orange_money: '📱',
  bank_transfer: '🏦',
}

export function PaymentMethodLabel({ payment }: { payment: Payment | undefined }) {
  const { t } = useTranslation()

  if (!payment) return <span className="text-text-disabled">—</span>

  return (
    <span className="flex flex-col">
      <span className="flex items-center gap-xs">
        <span aria-hidden="true">{ICON[payment.method]}</span>
        {t(`orders.paymentMethod.${payment.method}`)}
      </span>

      {/*
        Mobile Money est asynchrone : une commande peut rester en attente de
        confirmation plusieurs minutes (doc/03 §6). L'écran doit le montrer,
        sinon le vendeur croit à un échec.
      */}
      {payment.status === 'awaiting_confirmation' && (
        <span className="text-xs text-status-warning">
          {t('orders.payment.awaitingConfirmation')}
        </span>
      )}
    </span>
  )
}
