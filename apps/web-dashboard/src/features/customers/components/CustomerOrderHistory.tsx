import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import type { Order } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Button, Card, DataTable, EmptyState, type DataTableColumn } from '@shopnest/ui-web'
import { OrderStatusBadge, PaymentMethodLabel } from '@/features/orders'
import { countLabelKey } from '@/lib/count-label'
import { useCustomerOrders } from '../api/use-customers'

/**
 * doc/04 §2 — on consomme `@/features/orders` par son POINT D'ENTRÉE public,
 * jamais par un chemin interne : les deux features restent découplées.
 */
export function CustomerOrderHistory({
  customerId,
  onOpenOrder,
}: {
  customerId: string
  onOpenOrder: (orderId: string) => void
}) {
  const { t, tp, money, date } = useTranslation()
  const query = useCustomerOrders(customerId)

  const rows = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data])

  const columns = useMemo<DataTableColumn<Order>[]>(
    () => [
      {
        key: 'reference',
        header: t('orders.columns.reference'),
        render: (order) => (
          <div className="flex flex-col">
            <span className="font-medium tabular-nums">{order.reference}</span>
            <span className="text-xs text-text-secondary">
              {tp('orders.itemCount', order.items.length)}
            </span>
          </div>
        ),
      },
      {
        key: 'createdAt',
        header: t('orders.columns.createdAt'),
        width: 'w-40',
        render: (order) => date(order.createdAt),
      },
      {
        key: 'payment',
        header: t('orders.columns.payment'),
        render: (order) => <PaymentMethodLabel payment={order.payment} />,
      },
      {
        key: 'total',
        header: t('orders.columns.total'),
        align: 'end',
        render: (order) => <span className="tabular-nums">{money(order.total)}</span>,
      },
      {
        key: 'status',
        header: t('orders.columns.status'),
        width: 'w-40',
        render: (order) => <OrderStatusBadge status={order.status} />,
      },
    ],
    [t, tp, money, date],
  )

  const status = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : rows.length === 0
        ? 'empty'
        : 'success'

  const count = countLabelKey('orders.countShown', rows.length, query.data?.pages[0]?.total)

  return (
    <Card
      title={t('customers.detail.orderHistory')}
      description={t('customers.detail.orderHistoryHint')}
      action={
        <Link to="/orders" className="text-sm text-brand-primary hover:underline">
          {t('dashboard.recentOrders.seeAll')}
        </Link>
      }
      padded={false}
    >
      <div className="p-md">
        <DataTable<Order>
          caption={t('customers.detail.orderHistory')}
          status={status}
          rows={rows}
          error={query.error ?? undefined}
          onRetry={() => void query.refetch()}
          columns={columns}
          rowId={(order) => order.id}
          onRowClick={(order) => onOpenOrder(order.id)}
          skeletonRows={4}
          renderEmpty={() => <EmptyState title={t('customers.detail.noOrders')} />}
        />

        {status === 'success' && query.hasNextPage && (
          <div className="mt-md flex items-center justify-between text-sm text-text-secondary">
            <span>{tp(count.key, count.count, count.params)}</span>
            <Button
              variant="secondary"
              loading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {t('common.loadMore')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
