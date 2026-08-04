import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { KpiRow, RevenueChart, useDashboardSummary } from '@/features/dashboard'
import { StatisticsBreakdowns } from '@/features/statistics'

/**
 * doc/04 §2 — un fichier de route ASSEMBLE, il ne contient pas de logique.
 *
 * L'en-tête reprend les tuiles et la courbe du tableau de bord : la période
 * choisie ici doit être lisible sur les mêmes repères que les ventilations
 * qu'elle commande, sinon on compare des chiffres sans savoir à quoi.
 */
export function StatisticsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { range } = useSearch({ from: '/authenticated/statistics' })

  const summary = useDashboardSummary(range)

  return (
    <div className="flex flex-col gap-lg">
      <header>
        <h1 className="text-xl font-semibold text-text-primary">{t('stats.title')}</h1>
        <p className="text-sm text-text-secondary">{t('stats.subtitle')}</p>
      </header>

      <KpiRow summary={summary.data} loading={summary.isPending} />

      <RevenueChart
        summary={summary.data}
        loading={summary.isPending}
        error={summary.isError}
        onRetry={() => void summary.refetch()}
        range={range}
        onRangeChange={(next) =>
          void navigate({ to: '/statistics', search: { range: next }, replace: true })
        }
      />

      <StatisticsBreakdowns range={range} />
    </div>
  )
}
