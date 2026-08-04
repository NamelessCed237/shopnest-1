import { Link } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { cn, Icon } from '@shopnest/ui-web'
import { useSessionStore } from '@/features/auth'
import { NAV_SECTIONS, type NavItem } from './nav-items'

export interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  /** Fermeture du tiroir mobile après navigation — inutile en mode ancré. */
  onNavigate?: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, onNavigate }: SidebarProps) {
  const { t } = useTranslation()
  // Filtrage d'AFFICHAGE seulement : l'autorisation reste côté serveur, qui
  // refuse `/api/billing` à un employé quoi qu'affiche ce menu.
  const isAdmin = useSessionStore((state) => state.user?.role === 'tenant_admin')

  return (
    <div className="flex h-full flex-col bg-surface-base">
      <div
        className={cn(
          'flex h-14 shrink-0 items-center gap-sm border-b border-border-base px-md',
          { 'justify-center px-xs': collapsed },
        )}
      >
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-primary text-sm font-bold text-brand-onPrimary"
        >
          S
        </span>
        {!collapsed && <span className="text-base font-semibold text-text-primary">ShopNest</span>}
      </div>

      <nav aria-label={t('nav.main')} className="flex-1 overflow-y-auto p-sm">
        {NAV_SECTIONS.map((section) => (
          <div key={section.titleKey} className="mb-md last:mb-0">
            {/*
              Le titre de section disparaît en mode réduit : un libellé tronqué
              à deux lettres n'informe pas, il encombre.
            */}
            {!collapsed && (
              <h2 className="px-sm pb-xs text-[11px] font-semibold uppercase tracking-wider text-text-disabled">
                {t(section.titleKey)}
              </h2>
            )}

            <ul className="flex flex-col gap-xs">
              {section.items
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => (
                  <li key={item.labelKey}>
                    <SidebarLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border-base p-sm">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={t(collapsed ? 'nav.expand' : 'nav.collapse')}
          className="flex w-full items-center gap-sm rounded-md px-sm py-xs text-sm text-text-secondary outline-none hover:bg-surface-raised hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center">
            <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} />
          </span>
          {!collapsed && <span>{t('nav.collapse')}</span>}
        </button>
      </div>
    </div>
  )
}

function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  collapsed: boolean
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const label = t(item.labelKey)

  const base =
    'flex items-center gap-sm rounded-md px-sm py-sm text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus'

  // Un écran non implémenté reste VISIBLE mais explicitement inactif : le masquer
  // laisserait croire que la fonctionnalité n'existera pas.
  if (item.disabled) {
    return (
      <span
        aria-disabled="true"
        title={t('nav.comingSoon')}
        className={cn(base, 'cursor-not-allowed text-text-disabled', {
          'justify-center': collapsed,
        })}
      >
        <span aria-hidden="true" className="shrink-0">
          {item.icon}
        </span>
        {!collapsed && (
          <>
            <span className="truncate">{label}</span>
            <span className="ms-auto rounded-sm bg-surface-sunken px-xs text-[10px] uppercase">
              {t('nav.soon')}
            </span>
          </>
        )}
      </span>
    )
  }

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      // En mode réduit, l'icône seule ne suffit pas : le titre natif donne le
      // libellé à la souris, aria-label le donne aux technologies d'assistance.
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      /*
       * `includeSearch: false` : sans cela, `/` n'est jamais actif, car l'URL
       * réelle porte `?range=30d` (les filtres vivent dans l'URL, doc/04 §3) et
       * le lien, lui, n'a pas de paramètres. L'état actif suit le CHEMIN, pas
       * les filtres — sinon changer un filtre éteindrait l'entrée de menu.
       */
      activeOptions={{ exact: item.to === '/dashboard', includeSearch: false }}
      activeProps={{
        className: 'bg-brand-primarySubtle text-brand-primary font-medium',
        'aria-current': 'page',
      }}
      inactiveProps={{ className: 'text-text-secondary hover:bg-surface-raised hover:text-text-primary' }}
      className={cn(base, { 'justify-center': collapsed })}
    >
      <span aria-hidden="true" className="shrink-0">
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}
