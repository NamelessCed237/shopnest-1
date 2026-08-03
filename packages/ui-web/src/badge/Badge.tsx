import type { ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export interface BadgeProps {
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  children: ReactNode
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-sm py-xs text-xs font-medium',
        VARIANT[variant],
      )}
    >
      {children}
    </span>
  )
}

const VARIANT = {
  neutral: 'bg-surface-sunken text-text-secondary',
  success: 'bg-surface-raised text-status-success',
  warning: 'bg-surface-raised text-status-warning',
  danger: 'bg-surface-raised text-status-danger',
  info: 'bg-brand-primarySubtle text-brand-primary',
} as const
