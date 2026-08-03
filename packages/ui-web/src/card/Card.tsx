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
    <section className="rounded-lg border border-border-base bg-surface-base">
      {(title ?? action) && (
        <header className="flex items-start justify-between gap-md border-b border-border-base px-md py-sm">
          <div>
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
