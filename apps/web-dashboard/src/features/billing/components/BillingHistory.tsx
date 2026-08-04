import type { BillingSummary } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Card, EmptyState } from '@shopnest/ui-web'

/**
 * Relevé des douze derniers mois.
 *
 * Un TABLEAU et non un graphique : la question est « combien ai-je payé en
 * mars », pas « quelle est la tendance ». Un chiffre qu'on doit pouvoir
 * rapprocher d'un relevé bancaire se lit, il ne s'estime pas sur un axe.
 */
export function BillingHistory({ summary }: { summary: BillingSummary }) {
  const { t, money } = useTranslation()

  const active = summary.history.filter((period) => period.orderCount > 0)

  return (
    <Card
      title={t('billing.history.title')}
      description={t('billing.history.hint')}
      padded={false}
    >
      {active.length === 0 ? (
        <div className="p-md">
          <EmptyState title={t('billing.history.empty')} />
        </div>
      ) : (
        // Défilement horizontal PROPRE au tableau : sans ce conteneur, c'est la
        // page entière qui déborde sur mobile.
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">{t('billing.history.title')}</caption>
            <thead>
              <tr className="border-b border-border-base text-left text-text-secondary">
                <th scope="col" className="px-md py-sm font-medium">
                  {t('billing.history.month')}
                </th>
                <th scope="col" className="px-md py-sm text-right font-medium">
                  {t('billing.history.orders')}
                </th>
                <th scope="col" className="px-md py-sm text-right font-medium">
                  {t('billing.history.revenue')}
                </th>
                <th scope="col" className="px-md py-sm text-right font-medium">
                  {t('billing.history.fees')}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Du plus récent au plus ancien : c'est le mois en cours qu'on
                  vient vérifier, pas celui d'il y a un an. */}
              {[...active].reverse().map((period) => (
                <tr key={period.month} className="border-b border-border-base last:border-0">
                  <th scope="row" className="px-md py-sm text-left font-normal text-text-primary">
                    <MonthLabel iso={period.month} />
                  </th>
                  <td className="px-md py-sm text-right tabular-nums text-text-secondary">
                    {period.orderCount}
                  </td>
                  <td className="px-md py-sm text-right tabular-nums text-text-secondary">
                    {money(period.revenue)}
                  </td>
                  <td className="px-md py-sm text-right font-medium tabular-nums text-text-primary">
                    {money(period.fees)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/**
 * « mars 2026 » plutôt qu'une date complète.
 *
 * `date()` du contexte formaterait « 1 mars 2026 », et ce 1er n'existe pas :
 * la ligne couvre le mois entier. Afficher un jour ferait chercher ce qui s'est
 * passé ce jour-là.
 */
function MonthLabel({ iso }: { iso: string }) {
  const { locale } = useTranslation()
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(iso),
  )
  return <span className="capitalize">{label}</span>
}
