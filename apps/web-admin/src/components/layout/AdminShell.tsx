import { Suspense } from 'react'
import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { Button, Icon, LanguageSwitcher, ThemeToggle, type LanguageOption } from '@shopnest/ui-web'
import type { Locale } from '@shopnest/i18n'
import { useSessionStore } from '@/features/auth'

const LANGUAGES: readonly LanguageOption<Locale>[] = [
  { value: 'fr', label: 'Français', shortLabel: 'FR' },
  { value: 'en', label: 'English', shortLabel: 'EN' },
]

/**
 * Coque de l'administration — volontairement PLUS SOBRE que le dashboard
 * vendeur : deux écrans, pas de menu latéral.
 *
 * Une barre horizontale suffit tant que la navigation tient sur une ligne ;
 * reprendre le menu latéral du dashboard donnerait une colonne à moitié vide et
 * ferait croire à des sections manquantes.
 */
export function AdminShell() {
  const { t, locale, setLocale } = useTranslation()
  const navigate = useNavigate()
  const user = useSessionStore((state) => state.user)
  const signOut = useSessionStore((state) => state.signOut)

  const handleSignOut = () => {
    signOut()
    // Les gardes de route ne se rejouent qu'à la navigation : sans cet appel,
    // l'écran protégé resterait affiché après la déconnexion.
    void navigate({ to: '/login', replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-raised">
      <header className="sticky top-0 z-dropdown border-b border-border-base bg-surface-base/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-md px-md">
          <Link to="/" className="flex items-center gap-sm">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-md bg-text-primary text-sm font-bold text-surface-base"
            >
              <Icon name="shield" />
            </span>
            <span className="text-sm font-semibold text-text-primary">{t('admin.title')}</span>
          </Link>

          <nav aria-label={t('nav.main')} className="ms-md flex items-center gap-xs">
            <NavLink to="/" label={t('admin.nav.overview')} exact />
            <NavLink to="/tenants" label={t('admin.nav.tenants')} />
          </nav>

          <div className="ms-auto flex items-center gap-sm">
            <LanguageSwitcher
              value={locale}
              options={LANGUAGES}
              onChange={setLocale}
              groupLabel={t('preferences.language')}
            />
            <ThemeToggle
              groupLabel={t('preferences.theme')}
              labels={{
                system: t('preferences.theme.system'),
                light: t('preferences.theme.light'),
                dark: t('preferences.theme.dark'),
              }}
            />
            <span className="hidden text-xs text-text-secondary sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              {t('auth.signOut')}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 p-md">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-surface-sunken" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

function NavLink({ to, label, exact }: { to: '/' | '/tenants'; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      // `includeSearch: false` : les filtres vivent dans l'URL, et en changer
      // un ne doit pas éteindre l'entrée de menu.
      activeOptions={{ exact: exact ?? false, includeSearch: false }}
      activeProps={{ className: 'bg-brand-primarySubtle text-brand-primary', 'aria-current': 'page' }}
      inactiveProps={{ className: 'text-text-secondary hover:text-text-primary' }}
      className="rounded-md px-sm py-xs text-sm font-medium"
    >
      {label}
    </Link>
  )
}
