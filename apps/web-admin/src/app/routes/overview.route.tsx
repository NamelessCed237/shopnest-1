import { Link } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Card, Icon, StatTile } from '@shopnest/ui-web'
import { usePlatformSummary } from '@/features/tenants'

/** doc/04 §2 — un fichier de route ASSEMBLE, il ne contient pas de logique. */
export function AdminOverviewPage() {
  const { t, money, number } = useTranslation()
  const query = usePlatformSummary()
  const data = query.data

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-wrap items-end justify-between gap-md">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t('admin.overview.title')}</h1>
          <p className="text-sm text-text-secondary">{t('admin.overview.subtitle')}</p>
        </div>
        <Link to="/tenants" className="text-sm font-medium text-brand-primary hover:underline">
          {t('admin.overview.seeTenants')}
        </Link>
      </header>

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

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t('admin.overview.tenants')}
          icon={<Icon name="store" />}
          value={data ? number(data.tenantCount) : '—'}
          loading={query.isPending}
          hint={data ? t('admin.overview.activeCount', { count: data.activeTenantCount }) : undefined}
        />
        <StatTile
          label={t('admin.overview.products')}
          icon={<Icon name="store" />}
          value={data ? number(data.productCount) : '—'}
          loading={query.isPending}
        />
        <StatTile
          label={t('admin.overview.orders')}
          icon={<Icon name="sort" />}
          value={data ? number(data.orderCount) : '—'}
          loading={query.isPending}
        />
        <StatTile
          label={t('admin.overview.fees')}
          icon={<Icon name="credit-card" />}
          value={data ? money(data.platformFees) : '—'}
          loading={query.isPending}
          // Voir l'avertissement ci-dessous : le total n'a de sens que si toutes
          // les boutiques partagent la même devise.
          hint={data?.mixedCurrencies ? t('admin.overview.mixedShort') : undefined}
        />
      </div>

      {data?.mixedCurrencies && (
        <Alert variant="warning" title={t('admin.overview.mixedTitle')}>
          {t('admin.overview.mixedBody')}
        </Alert>
      )}
    </div>
  )
}
