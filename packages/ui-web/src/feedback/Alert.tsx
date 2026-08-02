import type { ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger'
  title?: string
  children: ReactNode
  /** Identifiant de corrélation affiché sur les erreurs internes (doc/02 §5). */
  traceId?: string
}

export function Alert({ variant = 'info', title, children, traceId }: AlertProps) {
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cn('flex flex-col gap-xs rounded-md border p-sm text-sm', VARIANT[variant])}
    >
      {title && <p className="font-medium">{title}</p>}
      <p>{children}</p>
      {traceId && <p className="text-xs opacity-70">Code : {traceId}</p>}
    </div>
  )
}

const VARIANT = {
  info: 'border-status-info text-status-info',
  success: 'border-status-success text-status-success',
  warning: 'border-status-warning text-status-warning',
  danger: 'border-status-danger text-status-danger',
} as const
