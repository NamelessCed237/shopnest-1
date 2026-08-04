import { Link, useParams } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Badge, Card, Icon } from '@shopnest/ui-web'
import { PlanSelector, ThemeEditor, useTenant } from '@/features/tenants'

/** doc/04 §2 — un fichier de route ASSEMBLE, il ne contient pas de logique. */
export function TenantDetailPage() {
  const { t, money, date } = useTranslation()
  const { tenantId } = useParams({ from: '/authenticated/tenants/$tenantId' })
  const query = useTenant(tenantId)

  return (
    <div className="flex flex-col gap-lg">
      <Link to="/tenants" className="flex items-center gap-xs text-sm text-brand-primary hover:underline">
        <Icon name="arrow-left" /> {t('admin.tenants.back')}
      </Link>

      {query.isPending && <div className="h-64 animate-pulse rounded-lg bg-surface-sunken" />}

      {query.isError && (
        <Card>
          <Alert
            variant="danger"
            traceId={query.error.code === 'INTERNAL' ? query.error.traceId : undefined}
          >
            {t(query.error.userMessageKey)}
          </Alert>
        </Card>
      )}

      {query.data && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-md">
            <div className="flex items-center gap-md">
              <span
                aria-hidden="true"
                className="h-10 w-10 shrink-0 rounded-md border border-border-base"
                style={{ backgroundColor: query.data.theme.brandPrimary ?? 'transparent' }}
              />
              <div>
                <h1 className="text-xl font-semibold text-text-primary">{query.data.name}</h1>
                <p className="text-sm text-text-secondary">
                  {query.data.customDomain ?? `${query.data.slug}.shopnest.app`}
                </p>
              </div>
            </div>
            <Badge variant="info">{query.data.planCode}</Badge>
          </header>

          <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
            <Metric label={t('admin.tenants.columns.products')} value={String(query.data.productCount)} />
            <Metric label={t('admin.tenants.columns.orders')} value={String(query.data.orderCount)} />
            <Metric label={t('admin.tenants.columns.revenue')} value={money(query.data.revenue)} />
          </div>

          <ThemeEditor tenant={query.data} />
          <PlanSelector tenant={query.data} />

          <p className="text-xs text-text-secondary">
            {t('admin.tenants.createdOn', { date: date(query.data.createdAt) })}
          </p>
        </>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-base/60 bg-surface-base p-md shadow-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      <p className="text-2xl font-semibold tabular-nums text-text-primary">{value}</p>
    </div>
  )
}
