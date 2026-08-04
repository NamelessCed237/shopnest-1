import { useMemo, useState } from 'react'
import type { ListProductsQuery, Product } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Button, DataTable, EmptyState, type DataTableColumn } from '@shopnest/ui-web'
import { countLabelKey } from '../../../lib/count-label'
import { BulkActionBar } from './BulkActionBar'
import { useProducts, type ProductFilters } from '../api/use-products'
import { ProductStatusBadge } from './ProductStatusBadge'
import { StockCell } from './StockCell'

type SortKey = NonNullable<ListProductsQuery['sortBy']>

export interface ProductsTableProps {
  filters: ProductFilters
  onSortChange: (sortBy: SortKey, sortOrder: 'asc' | 'desc') => void
  onResetFilters: () => void
  onOpenProduct: (productId: string) => void
}

export function ProductsTable({
  filters,
  onSortChange,
  onResetFilters,
  onOpenProduct,
}: ProductsTableProps) {
  const { t, tp, money, date } = useTranslation()
  const query = useProducts(filters)

  const rows = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  )

  const columns = useMemo<DataTableColumn<Product, SortKey>[]>(
    () => [
      {
        key: 'name',
        header: t('products.columns.name'),
        sortable: true,
        render: (product) => (
          <div className="flex flex-col">
            <span className="font-medium">{product.name}</span>
            <span className="text-xs text-text-secondary">{product.slug}</span>
          </div>
        ),
      },
      {
        key: 'price',
        header: t('products.columns.price'),
        sortable: true,
        align: 'end',
        render: (product) => money(product.price),
      },
      {
        key: 'stock',
        header: t('products.columns.stock'),
        sortable: true,
        align: 'end',
        render: (product) => <StockCell product={product} />,
      },
      {
        key: 'createdAt',
        header: t('products.columns.createdAt'),
        sortable: true,
        width: 'w-40',
        render: (product) => date(product.createdAt),
      },
    ],
    [t, money, date],
  )

  // Le tableau attend un état à quatre valeurs ; on le dérive une seule fois ici.
  const status = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : rows.length === 0
        ? 'empty'
        : 'success'

  const hasActiveFilter = Boolean(filters.search || filters.status || filters.categoryId)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const count = countLabelKey('products.countShown', rows.length, query.data?.pages[0]?.total)

  return (
    <div className="flex flex-col gap-md">
      <DataTable<Product, SortKey>
        caption={t('products.tableCaption')}
        status={status}
        rows={rows}
        error={query.error ?? undefined}
        onRetry={() => void query.refetch()}
        columns={[
          ...columns,
          {
            key: 'status' as SortKey,
            header: t('products.columns.status'),
            width: 'w-32',
            render: (product) => <ProductStatusBadge status={product.status} />,
          },
        ]}
        rowId={(product) => product.id}
        onRowClick={(product) => onOpenProduct(product.id)}
        sort={{ key: (filters.sortBy ?? 'createdAt') as SortKey, order: filters.sortOrder ?? 'desc' }}
        onSortChange={(sort) => onSortChange(sort.key, sort.order)}
        selectionMode="multiple"
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        renderEmpty={() =>
          hasActiveFilter ? (
            <EmptyState
              title={t('products.empty.filtered')}
              action={
                <Button variant="secondary" onClick={onResetFilters}>
                  {t('products.filters.reset')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              title={t('products.empty.title')}
              action={<Button onClick={() => onOpenProduct('new')}>{t('products.empty.action')}</Button>}
            />
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

      <BulkActionBar selectedIds={selectedIds} onClear={() => setSelectedIds([])} />
    </div>
  )
}
