import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { KpiRow, LowStockList, RecentOrders, RevenueChart, useDashboardSummary } from '@/features/dashboard'
import { useSessionStore } from '@/features/auth'

export function OverviewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { range } = useSearch({ from: '/authenticated/dashboard' })
  const user = useSessionStore((s) => s.user)

  const summary = useDashboardSummary(range)

  return (
    <div className="flex flex-col gap-lg">
      <header>
        <h1 className="text-xl font-semibold text-text-primary">
          {t('dashboard.greeting', { name: user?.email.split('@')[0] ?? '' })}
        </h1>
        <p className="text-sm text-text-secondary">{t('dashboard.subtitle')}</p>
      </header>

      <KpiRow summary={summary.data} loading={summary.isPending} />

      <RevenueChart
        summary={summary.data}
        loading={summary.isPending}
        error={summary.isError}
        onRetry={() => void summary.refetch()}
        range={range}
        onRangeChange={(next) =>
          void navigate({ to: '/dashboard', search: { range: next }, replace: true })
        }
      />

      {/* Deux colonnes sur grand écran, empilées en dessous — pas de largeur fixe. */}
      <div className="grid grid-cols-1 gap-md xl:grid-cols-[3fr_2fr]">
        <RecentOrders />
        <LowStockList />
      </div>
    </div>
  )
}
