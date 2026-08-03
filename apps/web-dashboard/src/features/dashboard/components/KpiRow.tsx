import type { DashboardSummary } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { StatTile } from '@shopnest/ui-web'

/**
 * skill dataviz — une poignée de chiffres phares se rend en RANGÉE DE TUILES,
 * pas en histogramme groupé : quatre mesures d'unités différentes n'ont aucun
 * axe commun, et les mettre sur un même graphique serait un double axe déguisé.
 */
export function KpiRow({
  summary,
  loading,
}: {
  summary: DashboardSummary | undefined
  loading: boolean
}) {
  const { t, money, number } = useTranslation()

  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label={t('dashboard.kpi.revenue')}
        value={summary ? money(summary.revenue) : '—'}
        delta={summary?.revenueDelta.ratio}
        loading={loading}
        hint={t('dashboard.kpi.vsPrevious')}
      />
      <StatTile
        label={t('dashboard.kpi.orders')}
        value={summary ? number(summary.orderCount) : '—'}
        delta={summary?.orderCountDelta.ratio}
        loading={loading}
        hint={t('dashboard.kpi.vsPrevious')}
      />
      <StatTile
        label={t('dashboard.kpi.averageOrderValue')}
        value={summary ? money(summary.averageOrderValue) : '—'}
        delta={summary?.averageOrderValueDelta.ratio}
        loading={loading}
        hint={t('dashboard.kpi.vsPrevious')}
      />
      <StatTile
        label={t('dashboard.kpi.stockAlerts')}
        value={summary ? number(summary.lowStockCount + summary.outOfStockCount) : '—'}
        loading={loading}
        hint={
          summary
            ? t('dashboard.kpi.stockBreakdown', {
                low: summary.lowStockCount,
                out: summary.outOfStockCount,
              })
            : undefined
        }
      />
    </div>
  )
}
