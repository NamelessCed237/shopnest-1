import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Card } from '@shopnest/ui-web'
import { StoreProfileForm, TeamCard, useTenantSettings } from '@/features/settings'
import { useSessionStore } from '@/features/auth'

/** doc/04 §2 — un fichier de route ASSEMBLE, il ne contient pas de logique. */
export function SettingsPage() {
  const { t } = useTranslation()
  const query = useTenantSettings()
  const role = useSessionStore((state) => state.user?.role)

  return (
    <div className="flex flex-col gap-lg">
      <header>
        <h1 className="text-xl font-semibold text-text-primary">{t('settings.title')}</h1>
        <p className="text-sm text-text-secondary">{t('settings.subtitle')}</p>
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

      {query.isPending && <div className="h-64 animate-pulse rounded-lg bg-surface-sunken" />}

      {query.data && (
        <>
          <StoreProfileForm settings={query.data} />

          {/*
            L'équipe et son quota ne concernent que l'administrateur — et
            l'endpoint le refuserait à un employé. Afficher une carte vouée à un
            403 serait une promesse non tenue.
          */}
          {role === 'tenant_admin' && <TeamCard planCode={query.data.planCode} />}
        </>
      )}
    </div>
  )
}
