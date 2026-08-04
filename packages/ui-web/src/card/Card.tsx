import type { ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export interface CardProps {
  title?: string
  description?: string
  action?: ReactNode
  padded?: boolean
  children: ReactNode
}

export function Card({ title, description, action, padded = true, children }: CardProps) {
  return (
    // Même parti que StatTile : ombre douce, bordure très pâle. Une carte doit
    // se détacher du fond sans que ses contours deviennent le motif dominant.
    <section className="rounded-lg border border-border-base/60 bg-surface-base shadow-sm">
      {(title ?? action) && (
        <header className="flex items-start justify-between gap-md border-b border-border-base/60 px-md py-md">
          <div className="flex flex-col gap-[2px]">
            {title && <h2 className="text-sm font-semibold text-text-primary">{title}</h2>}
            {description && <p className="text-xs text-text-secondary">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn({ 'p-md': padded })}>{children}</div>
    </section>
  )
}
