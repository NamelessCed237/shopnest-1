import { useMemo } from 'react'
import type { CustomerSummary } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Button, DataTable, EmptyState, type DataTableColumn } from '@shopnest/ui-web'
import { countLabelKey } from '@/lib/count-label'
import { customerDisplayName } from '@/lib/fake/customers.fixtures'
import { useCustomers, type CustomerFilters } from '../api/use-customers'
import { CustomerSegmentBadge } from './CustomerSegmentBadge'

type SortKey = NonNullable<CustomerFilters['sortBy']>

export interface CustomersTableProps {
  filters: CustomerFilters
  onSortChange: (sortBy: SortKey, sortOrder: 'asc' | 'desc') => void
  onResetFilters: () => void
  onOpenCustomer: (customerId: string) => void
}

export function CustomersTable({
  filters,
  onSortChange,
  onResetFilters,
  onOpenCustomer,
}: CustomersTableProps) {
  const { t, tp, money, date, number } = useTranslation()
  const query = useCustomers(filters)

  const rows = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data])

  const columns = useMemo<DataTableColumn<CustomerSummary, SortKey>[]>(
    () => [
      {
        key: 'name',
        header: t('customers.columns.customer'),
        sortable: true,
        render: (customer) => (
          <div className="flex items-center gap-sm">
            <Avatar name={customerDisplayName(customer)} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{customerDisplayName(customer)}</span>
              <span className="truncate text-xs text-text-secondary">{customer.email}</span>
            </div>
          </div>
        ),
      },
      {
        key: 'orderCount',
        header: t('customers.columns.orders'),
        sortable: true,
        align: 'end',
        render: (customer) => <span className="tabular-nums">{number(customer.orderCount)}</span>,
      },
      {
        key: 'totalSpent',
        header: t('customers.columns.totalSpent'),
        sortable: true,
        align: 'end',
        render: (customer) => (
          <div className="flex flex-col items-end">
            <span className="tabular-nums">{money(customer.totalSpent)}</span>
            <span className="text-xs text-text-secondary">
              {t('customers.averageOrder', { value: money(customer.averageOrderValue) })}
            </span>
          </div>
        ),
      },
      {
        key: 'lastOrderAt',
        header: t('customers.columns.lastOrder'),
        sortable: true,
        width: 'w-40',
        render: (customer) =>
          // Un client sans commande n'a pas de date : on l'écrit, on n'affiche
          // pas une date d'époque ni une case vide sans explication.
          customer.lastOrderAt ? (
            date(customer.lastOrderAt)
          ) : (
            <span className="text-text-disabled">{t('customers.noOrder')}</span>
          ),
      },
      {
        key: 'segment' as SortKey,
        header: t('customers.columns.segment'),
        width: 'w-36',
        render: (customer) => <CustomerSegmentBadge segment={customer.segment} />,
      },
    ],
    [t, money, date, number],
  )

  const status = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : rows.length === 0
        ? 'empty'
        : 'success'

  const hasActiveFilter = Boolean(filters.search || filters.segment)
  const count = countLabelKey('customers.countShown', rows.length, query.data?.pages[0]?.total)

  return (
    <div className="flex flex-col gap-md">
      <DataTable<CustomerSummary, SortKey>
        caption={t('customers.tableCaption')}
        status={status}
        rows={rows}
        error={query.error ?? undefined}
        onRetry={() => void query.refetch()}
        columns={columns}
        rowId={(customer) => customer.id}
        onRowClick={(customer) => onOpenCustomer(customer.id)}
        sort={{ key: filters.sortBy ?? 'lastOrderAt', order: filters.sortOrder ?? 'desc' }}
        onSortChange={(sort) => onSortChange(sort.key, sort.order)}
        renderEmpty={() =>
          hasActiveFilter ? (
            <EmptyState
              title={t('customers.empty.filtered')}
              action={
                <Button variant="secondary" onClick={onResetFilters}>
                  {t('products.filters.reset')}
                </Button>
              }
            />
          ) : (
            <EmptyState title={t('customers.empty.title')} />
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

/** Initiales — évite une requête d'image par ligne pour une simple pastille. */
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()

  return (
    <span
      aria-hidden="true"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-primarySubtle text-xs font-semibold text-brand-primary"
    >
      {initials}
    </span>
  )
}
