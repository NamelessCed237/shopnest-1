import type { Order } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Card } from '@shopnest/ui-web'

export function OrderItemsCard({ order }: { order: Order }) {
  const { t, tp, money, number } = useTranslation()

  return (
    <Card title={t('orders.detail.items')} padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{t('orders.detail.items')}</caption>
          <thead>
            <tr className="border-b border-border-base text-text-secondary">
              <th scope="col" className="px-md py-sm text-start font-medium">
                {t('orders.detail.product')}
              </th>
              <th scope="col" className="px-md py-sm text-end font-medium">
                {t('orders.detail.unitPrice')}
              </th>
              <th scope="col" className="px-md py-sm text-end font-medium">
                {t('orders.detail.quantity')}
              </th>
              <th scope="col" className="px-md py-sm text-end font-medium">
                {t('orders.columns.total')}
              </th>
            </tr>
          </thead>

          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-border-base last:border-0">
                <td className="px-md py-sm">
                  {/*
                    Le nom est l'INSTANTANÉ pris à la commande, pas le nom actuel
                    du produit : si le vendeur renomme ou archive l'article, la
                    commande doit rester lisible telle qu'elle a été passée.
                  */}
                  <span className="text-text-primary">{item.productName}</span>
                </td>
                <td className="px-md py-sm text-end tabular-nums">{money(item.unitPrice)}</td>
                <td className="px-md py-sm text-end tabular-nums">{number(item.quantity)}</td>
                <td className="px-md py-sm text-end font-medium tabular-nums">
                  {money(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border-base px-md py-sm text-xs text-text-secondary">
        {tp('orders.itemCount', order.items.length)}
      </p>
    </Card>
  )
}
