import type { DashboardRange } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Card, EmptyState, ErrorState, OptionSkeleton } from '@shopnest/ui-web'
import { useStatistics } from '../api/use-statistics'
import { RankedBarList } from './RankedBarList'

/**
 * Les trois ventilations et le mix acheteurs, sur une seule requête.
 *
 * Regroupés dans un composant plutôt qu'éclatés en quatre : ils partagent la
 * même requête et donc le même état de chargement. Quatre composants
 * appelleraient `useStatistics` chacun — TanStack Query dédupliquerait bien les
 * requêtes, mais chacun rendrait son propre squelette, et la page clignoterait
 * en quatre temps.
 */
export function StatisticsBreakdowns({ range }: { range: DashboardRange }) {
  const { t, tp, money } = useTranslation()
  const query = useStatistics(range)

  const skeleton = <OptionSkeleton count={5} />
  const failure = query.isError && (
    <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  )

  const data = query.data

  return (
    <div className="grid grid-cols-1 gap-md xl:grid-cols-2">
      <Card
        title={t('stats.topProducts.title')}
        description={t('stats.topProducts.hint')}
        padded={false}
      >
        {query.isPending && skeleton}
        {failure}
        {data && (
          <RankedBarList
            rows={data.topProducts.map((row) => ({
              id: row.productId,
              label: row.name,
              weight: row.revenue.amountCents,
              value: money(row.revenue),
              hint: tp('stats.topProducts.sold', row.quantitySold, { count: row.quantitySold }),
            }))}
            empty={<EmptyState title={t('stats.topProducts.empty')} />}
          />
        )}
      </Card>

      <Card
        title={t('stats.byCategory.title')}
        description={t('stats.byCategory.hint')}
        padded={false}
      >
        {query.isPending && skeleton}
        {failure}
        {data && (
          <RankedBarList
            rows={data.byCategory.map((row) => ({
              id: row.categoryId,
              label: row.name,
              weight: row.revenue.amountCents,
              value: money(row.revenue),
              hint: tp('stats.topProducts.sold', row.quantitySold, { count: row.quantitySold }),
            }))}
            empty={<EmptyState title={t('stats.topProducts.empty')} />}
          />
        )}
      </Card>

      <Card
        title={t('stats.byPayment.title')}
        description={t('stats.byPayment.hint')}
        padded={false}
      >
        {query.isPending && skeleton}
        {failure}
        {data && (
          <RankedBarList
            rows={data.byPaymentMethod.map((row) => ({
              id: row.method,
              // La clé de traduction est celle de l'écran commandes : le même
              // moyen de paiement ne doit pas s'appeler autrement d'un écran
              // à l'autre.
              label: t(`orders.paymentMethod.${row.method}`),
              weight: row.revenue.amountCents,
              value: money(row.revenue),
              hint: tp('stats.orderCount', row.orderCount, { count: row.orderCount }),
            }))}
            empty={<EmptyState title={t('stats.topProducts.empty')} />}
          />
        )}
      </Card>

      <Card title={t('stats.mix.title')}>
        {query.isPending && <OptionSkeleton count={2} />}
        {failure}
        {data && <BuyerMix newCount={data.newCustomers} returning={data.returningCustomers} />}
      </Card>
    </div>
  )
}

/**
 * Nouveaux contre fidélisés.
 *
 * Une barre empilée à deux segments, et non deux tuiles côte à côte : la
 * question posée est une PROPORTION — « ma croissance vient-elle de nouveaux
 * clients ou de mes habitués » — et deux nombres isolés obligent à faire la
 * division de tête.
 */
function BuyerMix({ newCount, returning }: { newCount: number; returning: number }) {
  const { t } = useTranslation()
  const total = newCount + returning

  if (total === 0) return <EmptyState title={t('stats.mix.empty')} />

  const newShare = (newCount / total) * 100

  return (
    <div className="flex flex-col gap-md">
      <div
        role="presentation"
        className="flex h-3 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div className="h-full bg-brand-primary" style={{ width: `${newShare}%` }} />
        <div className="h-full flex-1 bg-status-info" />
      </div>

      <dl className="grid grid-cols-2 gap-md">
        <Legend
          swatch="bg-brand-primary"
          label={t('stats.mix.new')}
          hint={t('stats.mix.newHint')}
          value={newCount}
        />
        <Legend
          swatch="bg-status-info"
          label={t('stats.mix.returning')}
          hint={t('stats.mix.returningHint')}
          value={returning}
        />
      </dl>
    </div>
  )
}

function Legend({
  swatch,
  label,
  hint,
  value,
}: {
  swatch: string
  label: string
  hint: string
  value: number
}) {
  return (
    <div className="flex flex-col gap-xs">
      <dt className="flex items-center gap-xs text-xs font-medium uppercase tracking-wide text-text-secondary">
        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${swatch}`} />
        {label}
      </dt>
      <dd className="text-xl font-semibold tabular-nums text-text-primary">{value}</dd>
      <p className="text-xs text-text-secondary">{hint}</p>
    </div>
  )
}
