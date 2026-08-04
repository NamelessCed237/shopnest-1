import type { Payment, PaymentMethod } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Icon, type IconName } from '@shopnest/ui-web'

/**
 * Mobile Money partage l'icône du téléphone : c'est le SUPPORT qui distingue
 * ces moyens de paiement de la carte, pas l'opérateur. Le nom, juste à côté,
 * fait la différence entre MTN et Orange.
 */
const ICON: Record<PaymentMethod, IconName> = {
  card: 'credit-card',
  mtn_momo: 'smartphone',
  orange_money: 'smartphone',
  bank_transfer: 'bank',
}

export function PaymentMethodLabel({ payment }: { payment: Payment | undefined }) {
  const { t } = useTranslation()

  if (!payment) return <span className="text-text-disabled">—</span>

  return (
    <span className="flex flex-col">
      <span className="flex items-center gap-xs">
        <span className="text-text-secondary">
          <Icon name={ICON[payment.method]} />
        </span>
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
