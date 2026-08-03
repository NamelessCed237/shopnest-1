import { useTranslation } from '@shopnest/i18n/react'
import { Button } from '@shopnest/ui-web'
import { useSessionStore } from '@/features/auth'
import { USE_FAKE_API } from '@/lib/api'
import { PreferencesControls } from './PreferencesControls'

export interface TopbarProps {
  onOpenMenu: () => void
  onLogout: () => void
  loggingOut: boolean
}

export function Topbar({ onOpenMenu, onLogout, loggingOut }: TopbarProps) {
  const { t } = useTranslation()
  const user = useSessionStore((s) => s.user)

  return (
    <header className="flex h-14 shrink-0 items-center gap-md border-b border-border-base bg-surface-base px-md">
      {/* Ouvre le tiroir : visible uniquement là où la sidebar est masquée. */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={t('nav.openMenu')}
        className="grid h-9 w-9 place-items-center rounded-md text-text-secondary outline-none hover:bg-surface-raised hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus lg:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      <div className="ms-auto flex items-center gap-md">
        <PreferencesControls />
        {USE_FAKE_API && (
          <span className="rounded-full bg-surface-sunken px-sm py-xs text-xs text-text-secondary">
            {t('common.demoMode')}
          </span>
        )}

        {user && (
          <span className="hidden text-sm text-text-secondary sm:inline">{user.email}</span>
        )}

        <Button variant="secondary" size="sm" onClick={onLogout} loading={loggingOut}>
          {t('auth.signOut')}
        </Button>
      </div>
    </header>
  )
}
