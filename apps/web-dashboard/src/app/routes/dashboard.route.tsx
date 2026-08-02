import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { Button } from '@shopnest/ui-web'
import { useLogout, useSessionStore } from '@/features/auth'

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()

  // La garde `beforeLoad` ne se rejoue qu'à la navigation : vider la session ne
  // suffit pas à quitter l'écran protégé, il faut naviguer explicitement.
  // `replace` pour que le bouton Retour ne ramène pas sur le dashboard vidé.
  const handleLogout = () =>
    logout.mutate(undefined, {
      onSettled: () => void navigate({ to: '/login', replace: true }),
    })

  return (
    <div className="min-h-screen bg-surface-raised">
      <header className="flex items-center justify-between border-b border-border-base bg-surface-base px-lg py-sm">
        <h1 className="text-lg font-semibold text-text-primary">ShopNest</h1>
        <div className="flex items-center gap-md">
          {user && <span className="text-sm text-text-secondary">{user.email}</span>}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLogout}
            loading={logout.isPending}
          >
            {t('auth.signOut')}
          </Button>
        </div>
      </header>

      <main className="p-lg">
        {/* TODO(#5): écrans produits, commandes, clients, statistiques (doc/04) */}
        <p className="text-text-secondary">{t('dashboard.placeholder')}</p>
      </main>
    </div>
  )
}
