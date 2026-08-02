import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert } from '@shopnest/ui-web'
import { LoginForm } from '@/features/auth'
import { USE_FAKE_API } from '@/lib/api'
import { FAKE_PASSWORD, fakeAccounts } from '@/lib/fake/fixtures'

/**
 * doc/04 §2 — un fichier de route ASSEMBLE, il ne contient pas de logique.
 * Toute la mécanique de connexion vit dans features/auth.
 */
export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-raised p-md">
      <div className="w-full max-w-sm rounded-lg border border-border-base bg-surface-base p-lg shadow-sm">
        <header className="mb-lg flex flex-col gap-xs">
          <h1 className="text-xl font-semibold text-text-primary">{t('auth.signInTitle')}</h1>
          <p className="text-sm text-text-secondary">{t('auth.signInSubtitle')}</p>
        </header>

        {USE_FAKE_API && (
          <div className="mb-md">
            <Alert variant="warning" title="Mode démonstration">
              Données factices, aucune base connectée. Comptes disponibles :{' '}
              {fakeAccounts.map((a) => a.user.email).join(', ')} — mot de passe{' '}
              <code>{FAKE_PASSWORD}</code>
            </Alert>
          </div>
        )}

        <LoginForm onSuccess={() => void navigate({ to: '/', replace: true })} />

        <p className="mt-lg text-center text-xs text-text-secondary">
          {t('auth.forgotPasswordHint')}
        </p>
      </div>
    </main>
  )
}
