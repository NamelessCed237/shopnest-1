import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { cn } from '@shopnest/ui-web'
import { useLogout } from '@/features/auth'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const COLLAPSED_KEY = 'shopnest.sidebar.collapsed'

/**
 * Coquille des écrans authentifiés : sidebar ancrée à partir de `lg`, tiroir
 * superposé en dessous.
 *
 * Une sidebar qui reste ancrée sur mobile mange la moitié de la largeur utile ;
 * une sidebar qui disparaît sans tiroir rend la navigation impossible. Les deux
 * modes partagent le MÊME composant `Sidebar` et la même définition de liens.
 */
export function AppShell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useLogout()

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === 'true',
  )
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  const toggleCollapse = useCallback(() => {
    setCollapsed((value) => {
      const next = !value
      // Préférence d'affichage : elle doit survivre au rechargement.
      localStorage.setItem(COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  const openDrawer = useCallback(() => {
    openerRef.current = document.activeElement as HTMLElement | null
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    // Le focus revient d'où il venait : sans cela il repart au début du document.
    openerRef.current?.focus()
  }, [])

  // Échap ferme le tiroir — attendu de toute surface superposée (doc/04 §8).
  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen, closeDrawer])

  // Le focus entre dans le tiroir à l'ouverture, sinon la tabulation continue
  // derrière le voile, sur du contenu que l'utilisateur ne voit pas.
  useEffect(() => {
    if (!drawerOpen) return
    drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus()
  }, [drawerOpen])

  const handleLogout = () =>
    logout.mutate(undefined, {
      onSettled: () => void navigate({ to: '/login', replace: true }),
    })

  return (
    <div className="flex min-h-screen bg-surface-raised">
      {/* Sidebar ancrée — masquée sous lg, remplacée par le tiroir. */}
      <aside
        className={cn(
          'hidden shrink-0 border-e border-border-base transition-[width] duration-normal lg:block',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className="sticky top-0 h-screen">
          <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        </div>
      </aside>

      {/* Tiroir mobile */}
      {drawerOpen && (
        <div className="fixed inset-0 z-modal lg:hidden">
          <button
            type="button"
            aria-label={t('nav.closeMenu')}
            onClick={closeDrawer}
            className="absolute inset-0 bg-surface-overlay"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.main')}
            className="absolute inset-y-0 start-0 w-64 border-e border-border-base shadow-lg"
          >
            <Sidebar
              collapsed={false}
              onToggleCollapse={closeDrawer}
              onNavigate={closeDrawer}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={openDrawer} onLogout={handleLogout} loggingOut={logout.isPending} />

        <main className="flex-1 p-lg">
          {/* Les routes sont chargées en lazy : frontière Suspense obligatoire. */}
          <Suspense
            fallback={<div className="h-64 animate-pulse rounded-md bg-surface-sunken" />}
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
