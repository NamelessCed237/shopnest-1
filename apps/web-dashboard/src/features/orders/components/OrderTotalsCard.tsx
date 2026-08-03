import type { Order } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Card } from '@shopnest/ui-web'

export function OrderTotalsCard({ order }: { order: Order }) {
  const { t, money } = useTranslation()

  const hasDiscount = order.discount.amountCents > 0
  const hasTax = order.tax.amountCents > 0

  return (
    <Card title={t('orders.detail.totals')}>
      <dl className="flex flex-col gap-xs text-sm">
        <Line label={t('orders.detail.subtotal')} value={money(order.subtotal)} />

        <Line
          label={t('orders.detail.shipping')}
          value={
            order.shipping.amountCents === 0
              ? t('orders.detail.freeShipping')
              : money(order.shipping)
          }
        />

        {/* Les lignes à zéro sont masquées : afficher « Remise 0 FCFA » sur la
            majorité des commandes ajoute du bruit sans information. */}
        {hasDiscount && (
          <Line
            label={t('orders.detail.discount')}
            value={`− ${money(order.discount)}`}
            tone="success"
          />
        )}

        {hasTax && <Line label={t('orders.detail.tax')} value={money(order.tax)} />}

        <div className="mt-xs flex items-baseline justify-between border-t border-border-base pt-sm">
          <dt className="font-semibold text-text-primary">{t('orders.columns.total')}</dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {money(order.total)}
          </dd>
        </div>

        {/* Commission ShopNest — c'est le revenu de la plateforme, pas celui du
            vendeur : on l'isole visuellement pour éviter toute confusion. */}
        <div className="mt-sm flex items-baseline justify-between rounded-md bg-surface-raised px-sm py-xs">
          <dt className="text-xs text-text-secondary">{t('orders.detail.platformFee')}</dt>
          <dd className="text-xs tabular-nums text-text-secondary">{money(order.platformFee)}</dd>
        </div>
      </dl>
    </Card>
  )
}

function Line({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success'
}) {
  return (
    <div className="flex items-baseline justify-between gap-md">
      <dt className="text-text-secondary">{label}</dt>
      <dd
        className={`tabular-nums ${tone === 'success' ? 'text-status-success' : 'text-text-primary'}`}
      >
        {value}
      </dd>
    </div>
  )
}
