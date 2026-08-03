import { Link } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { Card, EmptyState, ErrorState, OptionSkeleton } from '@shopnest/ui-web'
import { useLowStockProducts } from '../api/use-dashboard'

/**
 * skill dataviz — un ratio contre une limite se rend en JAUGE sur la même rampe,
 * pas en camembert à deux parts. La barre ci-dessous est cette jauge : elle rend
 * lisible d'un coup d'œil « à quelle distance du seuil » chaque produit se trouve.
 */
export function LowStockList() {
  const { t, tp } = useTranslation()
  const query = useLowStockProducts()

  return (
    <Card
      title={t('dashboard.lowStock.title')}
      description={t('dashboard.lowStock.description')}
      action={
        <Link to="/products" className="text-sm text-brand-primary underline">
          {t('dashboard.lowStock.manage')}
        </Link>
      }
      padded={false}
    >
      {query.isPending && <OptionSkeleton count={4} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {!query.isPending && !query.isError && query.data.length === 0 && (
        <EmptyState title={t('dashboard.lowStock.empty')} />
      )}

      {query.data && query.data.length > 0 && (
        <ul className="divide-y divide-border-base">
          {query.data.map((product) => {
            const isOut = product.stock === 0
            const ratio = Math.min(product.stock / Math.max(product.lowStockThreshold, 1), 1)

            return (
              <li key={product.id} className="flex flex-col gap-xs px-md py-sm">
                <div className="flex items-center justify-between gap-md">
                  <span className="truncate text-sm text-text-primary">{product.name}</span>
                  <span
                    className={`shrink-0 text-xs font-medium tabular-nums ${
                      isOut ? 'text-status-danger' : 'text-status-warning'
                    }`}
                  >
                    {isOut
                      ? t('products.stock.out')
                      : tp('dashboard.lowStock.remaining', product.stock)}
                  </span>
                </div>

                <div
                  className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"
                  role="img"
                  aria-label={t('dashboard.lowStock.gauge', {
                    stock: product.stock,
                    threshold: product.lowStockThreshold,
                  })}
                >
                  <div
                    className={`h-full rounded-full ${isOut ? 'bg-status-danger' : 'bg-status-warning'}`}
                    style={{ width: `${Math.max(ratio * 100, isOut ? 100 : 6)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
