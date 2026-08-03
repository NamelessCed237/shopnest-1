import { useMemo } from 'react'
import type { Order } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Button, DataTable, EmptyState, type DataTableColumn } from '@shopnest/ui-web'
import { countLabelKey } from '@/lib/count-label'
import { fakeCustomerName } from '@/lib/fake/orders.fixtures'
import { useOrders, type OrderFilters } from '../api/use-orders'
import { OrderStatusBadge } from './OrderStatusBadge'
import { PaymentMethodLabel } from './PaymentMethodLabel'

type SortKey = 'createdAt' | 'total'

export interface OrdersTableProps {
  filters: OrderFilters
  onSortChange: (sortBy: SortKey, sortOrder: 'asc' | 'desc') => void
  onResetFilters: () => void
  onOpenOrder: (orderId: string) => void
}

export function OrdersTable({
  filters,
  onSortChange,
  onResetFilters,
  onOpenOrder,
}: OrdersTableProps) {
  const { t, tp, money, date } = useTranslation()
  const query = useOrders(filters)

  const rows = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data])

  const columns = useMemo<DataTableColumn<Order, SortKey>[]>(
    () => [
      {
        key: 'reference' as SortKey,
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
        key: 'customer' as SortKey,
        header: t('orders.columns.customer'),
        render: (order) => fakeCustomerName(order.customerId),
      },
      {
        key: 'createdAt',
        header: t('orders.columns.createdAt'),
        sortable: true,
        width: 'w-40',
        render: (order) => date(order.createdAt),
      },
      {
        key: 'payment' as SortKey,
        header: t('orders.columns.payment'),
        render: (order) => <PaymentMethodLabel payment={order.payment} />,
      },
      {
        key: 'total',
        header: t('orders.columns.total'),
        sortable: true,
        align: 'end',
        render: (order) => <span className="tabular-nums">{money(order.total)}</span>,
      },
      {
        key: 'status' as SortKey,
        header: t('orders.columns.status'),
        width: 'w-40',
        render: (order) => <OrderStatusBadge status={order.status} />,
      },
    ],
    [t, money, date],
  )

  const status = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : rows.length === 0
        ? 'empty'
        : 'success'

  const hasActiveFilter = Boolean(filters.search || filters.status || filters.paymentMethod)
  const count = countLabelKey('orders.countShown', rows.length, query.data?.pages[0]?.total)

  return (
    <div className="flex flex-col gap-md">
      <DataTable<Order, SortKey>
        caption={t('orders.tableCaption')}
        status={status}
        rows={rows}
        error={query.error ?? undefined}
        onRetry={() => void query.refetch()}
        columns={columns}
        rowId={(order) => order.id}
        onRowClick={(order) => onOpenOrder(order.id)}
        sort={{ key: filters.sortBy ?? 'createdAt', order: filters.sortOrder ?? 'desc' }}
        onSortChange={(sort) => onSortChange(sort.key, sort.order)}
        renderEmpty={() =>
          hasActiveFilter ? (
            <EmptyState
              title={t('orders.empty.filtered')}
              action={
                <Button variant="secondary" onClick={onResetFilters}>
                  {t('products.filters.reset')}
                </Button>
              }
            />
          ) : (
            <EmptyState title={t('orders.empty.title')} />
          )
        }
      />

      {status === 'success' && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>{tp(count.key, count.count, count.params)}</span>
          {query.hasNextPage && (
            <Button
              variant="secondary"
              loading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {t('common.loadMore')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
