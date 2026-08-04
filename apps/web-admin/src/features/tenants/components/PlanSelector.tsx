import { useState } from 'react'
import { PLAN_CODES, PLAN_LIMITS, type AdminTenant, type PlanCode } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Card, Dropdown } from '@shopnest/ui-web'
import { useUpdateTenantPlan } from '../api/use-tenants'

/**
 * Changement de plan d'une boutique.
 *
 * Le passage à un plan INFÉRIEUR est signalé quand la boutique dépasse déjà les
 * nouvelles limites : le backend n'efface aucun produit — il refusera seulement
 * les prochaines créations. Sans cet avertissement, l'administrateur croirait le
 * changement sans conséquence, et le vendeur découvrirait le blocage tout seul.
 */
export function PlanSelector({ tenant }: { tenant: AdminTenant }) {
  const { t, number } = useTranslation()
  const mutation = useUpdateTenantPlan(tenant.id)
  const [plan, setPlan] = useState<PlanCode>(tenant.planCode)

  const limits = PLAN_LIMITS[plan]
  const overProducts = tenant.productCount > limits.maxProducts

  return (
    <Card title={t('admin.plan.title')} description={t('admin.plan.hint')}>
      <div className="flex flex-col gap-md">
        {mutation.error && (
          <Alert
            variant="danger"
            traceId={mutation.error.code === 'INTERNAL' ? mutation.error.traceId : undefined}
          >
            {t(mutation.error.userMessageKey)}
          </Alert>
        )}

        <Dropdown<PlanCode>
          label={t('admin.plan.current')}
          source={PLAN_CODES.map((code) => ({
            value: code,
            label: code,
            description: t('admin.plan.option', {
              products: Number.isFinite(PLAN_LIMITS[code].maxProducts)
                ? number(PLAN_LIMITS[code].maxProducts)
                : '∞',
              users: Number.isFinite(PLAN_LIMITS[code].maxStaffUsers)
                ? number(PLAN_LIMITS[code].maxStaffUsers)
                : '∞',
            }),
          }))}
          value={plan}
          onChange={(next) => next && setPlan(next)}
        />

        {overProducts && (
          <Alert variant="warning" title={t('admin.plan.downgradeTitle')}>
            {t('admin.plan.downgradeBody', {
              products: number(tenant.productCount),
              limit: number(limits.maxProducts),
            })}
          </Alert>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => mutation.mutate(plan)}
            loading={mutation.isPending}
            disabled={plan === tenant.planCode}
          >
            {t('admin.plan.apply')}
          </Button>
        </div>
      </div>
    </Card>
  )
}
