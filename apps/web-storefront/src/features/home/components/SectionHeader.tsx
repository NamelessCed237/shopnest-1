import type { ReactNode } from 'react'
import { Icon } from '@shopnest/ui-web'

export interface SectionHeaderProps {
  title: string
  subtitle?: string
  actionLabel?: string
  actionHref?: string
  /** Contrôles personnalisés à droite (flèches de carrousel, par exemple). */
  action?: ReactNode
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  actionHref,
  action,
}: SectionHeaderProps) {
  return (
    <div className="mb-md flex flex-wrap items-end justify-between gap-sm">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary">{title}</h2>
        {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
      </div>

      {action ??
        (actionLabel && actionHref && (
          <a
            href={actionHref}
            className="flex items-center gap-xs text-sm font-medium text-brand-primary hover:underline"
          >
            {actionLabel}
            <Icon name="arrow-right" size="sm" />
          </a>
        ))}
    </div>
  )
}
