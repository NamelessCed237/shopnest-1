import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Icon } from '@shopnest/ui-web'
import { AdminLoginForm } from '@/features/auth'

/** doc/04 §2 — un fichier de route ASSEMBLE, il ne contient pas de logique. */
export function AdminLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-raised p-md">
      <div className="w-full max-w-sm rounded-lg border border-border-base/60 bg-surface-base p-lg shadow-sm">
        <header className="mb-lg flex flex-col gap-xs">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-text-primary text-surface-base">
            <Icon name="shield" size="lg" />
          </span>
          <h1 className="text-xl font-semibold text-text-primary">{t('admin.auth.title')}</h1>
          <p className="text-sm text-text-secondary">{t('admin.auth.subtitle')}</p>
        </header>

        {/*
          Avertissement PERMANENT, et non un bandeau de démonstration : cet
          écran ouvre l'accès à toutes les boutiques de la plateforme. Le
          rappeler à chaque connexion n'est pas de trop.
        */}
        <div className="mb-md">
          <Alert variant="warning">{t('admin.auth.warning')}</Alert>
        </div>

        <AdminLoginForm onSuccess={() => void navigate({ to: '/', replace: true })} />
      </div>
    </div>
  )
}
