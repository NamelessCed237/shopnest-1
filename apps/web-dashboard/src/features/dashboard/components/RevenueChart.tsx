import { useMemo, useState } from 'react'
import { DASHBOARD_RANGES, type DashboardRange, type DashboardSummary } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Card, TrendChart, type TrendPoint } from '@shopnest/ui-web'

export interface RevenueChartProps {
  summary: DashboardSummary | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
  range: DashboardRange
  onRangeChange: (range: DashboardRange) => void
}

export function RevenueChart({
  summary,
  loading,
  error,
  onRetry,
  range,
  onRangeChange,
}: RevenueChartProps) {
  const { t, money, locale } = useTranslation()
  const [showTable, setShowTable] = useState(false)

  const points = useMemo<TrendPoint[]>(
    () =>
      (summary?.series ?? []).map((point) => ({
        label: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
          new Date(point.date),
        ),
        value: point.revenue.amountCents,
        display: money(point.revenue),
      })),
    [summary, locale, money],
  )

  return (
    <Card
      title={t('dashboard.chart.title')}
      description={t('dashboard.chart.description')}
      action={
        // skill dataviz — les filtres tiennent sur UNE rangée au-dessus du graphique.
        <div className="flex items-center gap-xs" role="group" aria-label={t('dashboard.chart.rangeLabel')}>
          {DASHBOARD_RANGES.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={value === range ? 'primary' : 'ghost'}
              aria-pressed={value === range}
              onClick={() => onRangeChange(value)}
            >
              {t(`dashboard.range.${value}`)}
            </Button>
          ))}
        </div>
      }
    >
      {error ? (
        <div className="flex flex-col items-start gap-sm">
          <Alert variant="danger">{t('errors.generic')}</Alert>
          <Button variant="secondary" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        </div>
      ) : loading ? (
        <div className="h-56 animate-pulse rounded-md bg-surface-sunken" aria-busy="true" />
      ) : (
        <>
          <TrendChart
            points={points}
            ariaLabel={t('dashboard.chart.ariaLabel')}
            formatTick={(value) =>
              money({ amountCents: value, currency: summary?.revenue.currency ?? 'XAF' })
            }
          />

          {/*
            skill dataviz — une vue tableau existe toujours : elle rend la donnée
            accessible aux lecteurs d'écran et lisible sans percevoir les couleurs.
          */}
          <div className="mt-sm">
            <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)}>
              {showTable ? t('dashboard.chart.hideTable') : t('dashboard.chart.showTable')}
            </Button>
          </div>

          {showTable && (
            <div className="mt-sm max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t('dashboard.chart.ariaLabel')}</caption>
                <thead>
                  <tr className="border-b border-border-base text-start text-text-secondary">
                    <th scope="col" className="py-xs text-start font-medium">
                      {t('dashboard.chart.dateColumn')}
                    </th>
                    <th scope="col" className="py-xs text-end font-medium">
                      {t('dashboard.kpi.revenue')}
                    </th>
                    <th scope="col" className="py-xs text-end font-medium">
                      {t('dashboard.kpi.orders')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.series ?? []).map((point) => (
                    <tr key={point.date} className="border-b border-border-base last:border-0">
                      <td className="py-xs">{point.date.slice(0, 10)}</td>
                      <td className="py-xs text-end tabular-nums">{money(point.revenue)}</td>
                      <td className="py-xs text-end tabular-nums">{point.orderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
