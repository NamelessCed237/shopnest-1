import { Link } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { Card, EmptyState, ErrorState, OptionSkeleton } from '@shopnest/ui-web'
import { OrderStatusBadge } from '@/features/orders'
import { fakeCustomerName } from '@/lib/fake/orders.fixtures'
import { useRecentOrders } from '../api/use-dashboard'

export function RecentOrders() {
  const { t, money, date } = useTranslation()
  const query = useRecentOrders()

  return (
    <Card
      title={t('dashboard.recentOrders.title')}
      action={
        <Link to="/orders" className="text-sm text-brand-primary underline">
          {t('dashboard.recentOrders.seeAll')}
        </Link>
      }
      padded={false}
    >
      {/* Les quatre états, ici aussi (doc/04 §7). */}
      {query.isPending && <OptionSkeleton count={5} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {!query.isPending && !query.isError && query.data.length === 0 && (
        <EmptyState title={t('orders.empty.title')} />
      )}

      {query.data && query.data.length > 0 && (
        <ul className="divide-y divide-border-base">
          {query.data.map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-md px-md py-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {order.reference}
                  <span className="ml-sm font-normal text-text-secondary">
                    {fakeCustomerName(order.customerId)}
                  </span>
                </p>
                <p className="text-xs text-text-secondary">{date(order.createdAt)}</p>
              </div>

              <div className="flex shrink-0 items-center gap-md">
                <span className="text-sm tabular-nums text-text-primary">{money(order.total)}</span>
                <OrderStatusBadge status={order.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
