import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { AdminTenant } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Badge, Button, DataTable, EmptyState, type BadgeProps, type DataTableColumn } from '@shopnest/ui-web'
import { TENANT_STATUS } from '@shopnest/contracts'
import { useTenants, type TenantFilters } from '../api/use-tenants'

/**
 * `satisfies Record<TenantStatus, …>` : ajouter un statut au contrat sans
 * l'habiller ici devient une erreur de compilation, au lieu d'une pastille
 * grise silencieuse.
 */
const STATUS_VARIANT = {
  trialing: 'info',
  active: 'success',
  past_due: 'warning',
  suspended: 'danger',
  cancelled: 'neutral',
} satisfies Record<(typeof TENANT_STATUS)[number], NonNullable<BadgeProps['variant']>>

export function TenantsTable({ filters }: { filters: TenantFilters }) {
  const { t, money, date } = useTranslation()
  const navigate = useNavigate()
  const query = useTenants(filters)

  const rows = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data])

  const columns = useMemo<DataTableColumn<AdminTenant, never>[]>(
    () => [
      {
        key: 'name' as never,
        header: t('admin.tenants.columns.store'),
        render: (tenant) => (
          <div className="flex items-center gap-sm">
            {/*
              Pastille de la couleur de marque : c'est le repère le plus rapide
              pour retrouver une boutique dont on vient de régler le thème.
            */}
            <span
              aria-hidden="true"
              className="h-6 w-6 shrink-0 rounded-md border border-border-base"
              style={{ backgroundColor: tenant.theme.brandPrimary ?? 'transparent' }}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-text-primary">{tenant.name}</span>
              <span className="truncate text-xs text-text-secondary">
                {tenant.customDomain ?? `${tenant.slug}.shopnest.app`}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'plan' as never,
        header: t('admin.tenants.columns.plan'),
        render: (tenant) => <Badge variant="info">{tenant.planCode}</Badge>,
      },
      {
        key: 'status' as never,
        header: t('admin.tenants.columns.status'),
        render: (tenant) => (
          <Badge variant={STATUS_VARIANT[tenant.status]}>
            {t(`admin.tenants.status.${tenant.status}`)}
          </Badge>
        ),
      },
      {
        key: 'products' as never,
        header: t('admin.tenants.columns.products'),
        align: 'end',
        render: (tenant) => <span className="tabular-nums">{tenant.productCount}</span>,
      },
      {
        key: 'revenue' as never,
        header: t('admin.tenants.columns.revenue'),
        align: 'end',
        render: (tenant) => <span className="tabular-nums">{money(tenant.revenue)}</span>,
      },
      {
        key: 'lastOrder' as never,
        header: t('admin.tenants.columns.lastOrder'),
        width: 'w-40',
        render: (tenant) =>
          tenant.lastOrderAt ? (
            date(tenant.lastOrderAt)
          ) : (
            <span className="text-text-disabled">—</span>
          ),
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

  return (
    <div className="flex flex-col gap-md">
      <DataTable<AdminTenant, never>
        caption={t('admin.tenants.tableCaption')}
        status={status}
        rows={rows}
        error={query.error ?? undefined}
        onRetry={() => void query.refetch()}
        columns={columns}
        rowId={(tenant) => tenant.id}
        onRowClick={(tenant) => void navigate({ to: '/tenants/$tenantId', params: { tenantId: tenant.id } })}
        renderEmpty={() => <EmptyState title={t('admin.tenants.empty')} />}
      />

      {query.hasNextPage && (
        <div className="flex justify-center">
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
  )
}
