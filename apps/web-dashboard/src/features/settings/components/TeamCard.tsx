import { PLAN_LIMITS, type PlanCode } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Badge, Card, ErrorState, OptionSkeleton } from '@shopnest/ui-web'
import { useTeam } from '../api/use-settings'

/**
 * Membres ayant accès au tableau de bord.
 *
 * En lecture seule : inviter ou révoquer un utilisateur suppose un envoi
 * d'email et une gestion d'invitations en attente, qui n'existent pas encore
 * côté backend. Afficher un bouton qui ne fait rien serait pire que son absence.
 */
export function TeamCard({ planCode }: { planCode: PlanCode }) {
  const { t, date } = useTranslation()
  const query = useTeam()

  const limit = PLAN_LIMITS[planCode].maxStaffUsers
  const used = query.data?.length ?? 0

  return (
    <Card
      title={t('settings.team.title')}
      description={t('settings.team.hint')}
      action={
        query.data && (
          <span className="text-xs tabular-nums text-text-secondary">
            {Number.isFinite(limit)
              ? t('settings.team.quota', { used, limit })
              : t('settings.team.quotaUnlimited', { used })}
          </span>
        )
      }
      padded={false}
    >
      {query.isPending && <OptionSkeleton count={2} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}

      {query.data && (
        <ul className="divide-y divide-border-base">
          {query.data.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-sm px-md py-sm"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-text-primary">{member.email}</span>
                <span className="text-xs text-text-secondary">
                  {t('settings.team.since')} · {date(member.createdAt)}
                </span>
              </div>

              <Badge variant={member.role === 'tenant_admin' ? 'info' : 'neutral'}>
                {t(`settings.role.${member.role}`)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
