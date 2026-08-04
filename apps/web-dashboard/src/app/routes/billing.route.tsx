import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Card, StatTile } from '@shopnest/ui-web'
import { BillingHistory, PlanCard, useBillingSummary } from '@/features/billing'

/** doc/04 §2 — un fichier de route ASSEMBLE, il ne contient pas de logique. */
export function BillingPage() {
  const { t, money } = useTranslation()
  const query = useBillingSummary()

  return (
    <div className="flex flex-col gap-lg">
      <header>
        <h1 className="text-xl font-semibold text-text-primary">{t('billing.title')}</h1>
        <p className="text-sm text-text-secondary">{t('billing.subtitle')}</p>
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

      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <StatTile
          label={t('billing.fees.current')}
          value={query.data ? money(query.data.currentMonthFees) : '—'}
          loading={query.isPending}
        />
        <StatTile
          label={t('billing.fees.previous')}
          value={query.data ? money(query.data.previousMonthFees) : '—'}
          loading={query.isPending}
        />
        <StatTile
          label={t('billing.fees.lifetime')}
          value={query.data ? money(query.data.lifetimeFees) : '—'}
          loading={query.isPending}
        />
      </div>

      {query.data && (
        <>
          <PlanCard summary={query.data} />
          <BillingHistory summary={query.data} />
        </>
      )}
    </div>
  )
}
