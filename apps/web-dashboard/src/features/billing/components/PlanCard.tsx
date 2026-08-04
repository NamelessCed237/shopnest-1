import { PLAN_LIMITS, quotaRatio, type BillingSummary } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Badge, Card, Icon } from '@shopnest/ui-web'

/**
 * Plan, quotas et fonctionnalités incluses.
 *
 * Les limites viennent de `PLAN_LIMITS` (@shopnest/contracts) et non de la
 * réponse serveur : c'est la source de vérité unique (doc/02 §1.2), et
 * `Infinity` du plan Enterprise ne survivrait pas à un aller-retour JSON.
 */
export function PlanCard({ summary }: { summary: BillingSummary }) {
  const { t } = useTranslation()
  const limits = PLAN_LIMITS[summary.planCode]

  const feeLabel =
    limits.transactionFeeRate === null
      ? t('billing.plan.feeNegotiated')
      : t('billing.plan.feeRate', {
          rate: new Intl.NumberFormat(undefined, {
            style: 'percent',
            maximumFractionDigits: 2,
          }).format(limits.transactionFeeRate),
        })

  return (
    <Card
      title={t('billing.plan.title', { plan: summary.planCode })}
      description={feeLabel}
    >
      <div className="flex flex-col gap-lg">
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <Quota
            label={t('billing.quota.products')}
            used={summary.usage.products}
            limit={limits.maxProducts}
          />
          <Quota
            label={t('billing.quota.staff')}
            used={summary.usage.staffUsers}
            limit={limits.maxStaffUsers}
          />
        </div>

        <div className="flex flex-col gap-sm">
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            {t('billing.features.title')}
          </h3>
          <ul className="flex flex-wrap gap-xs">
            <Feature enabled={limits.customDomain} label={t('billing.features.customDomain')} />
            <Feature
              enabled={limits.advancedAnalytics}
              label={t('billing.features.advancedAnalytics')}
            />
            <Feature enabled={limits.bankTransfer} label={t('billing.features.bankTransfer')} />
          </ul>
        </div>
      </div>
    </Card>
  )
}

/**
 * Jauge de quota.
 *
 * Une barre sur la même rampe que la limite, pas un pourcentage écrit : la
 * question du vendeur est « combien me reste-t-il », qui se lit d'un coup d'œil
 * sur une longueur et pas sur un nombre à interpréter.
 */
function Quota({ label, used, limit }: { label: string; used: number; limit: number }) {
  const { t } = useTranslation()
  const unlimited = !Number.isFinite(limit)
  const ratio = quotaRatio(used, limit)
  const full = !unlimited && used >= limit

  return (
    <div className="flex flex-col gap-xs">
      <div className="flex items-baseline justify-between gap-sm">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className="text-sm font-medium tabular-nums text-text-primary">
          {unlimited
            ? t('billing.quota.unlimited', { used })
            : t('billing.quota.usage', { used, limit })}
        </span>
      </div>

      <div
        role="img"
        aria-label={
          unlimited
            ? t('billing.quota.unlimited', { used })
            : t('billing.quota.usage', { used, limit })
        }
        className="h-2 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className={`h-full rounded-full ${full ? 'bg-status-danger' : 'bg-brand-primary'}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      {full && <span className="text-xs text-status-danger">{t('billing.quota.full')}</span>}
    </div>
  )
}

/**
 * Une fonctionnalité absente reste AFFICHÉE, en gris.
 *
 * La masquer laisserait croire qu'elle n'existe pas ; la montrer désactivée dit
 * ce que le plan supérieur apporterait.
 */
function Feature({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <li>
      <Badge variant={enabled ? 'success' : 'neutral'}>
        <Icon name={enabled ? 'check' : 'minus'} size="sm" /> {label}
      </Badge>
    </li>
  )
}
