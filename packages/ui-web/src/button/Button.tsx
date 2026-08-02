import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  /** Affiche un état occupé ET désactive le bouton : protège du double-clic. */
  loading?: boolean
  fullWidth?: boolean
  leadingIcon?: ReactNode
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth, leadingIcon, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      // On désactive pendant l'envoi, ET l'action est idempotente côté serveur :
      // on protège contre le double-clic aux deux bouts (doc/04 §5).
      disabled={rest.disabled ?? loading}
      aria-busy={loading}
      className={cn(BASE, VARIANT[variant], SIZE[size], { 'w-full': Boolean(fullWidth) })}
      {...rest}
    >
      {loading ? <Spinner /> : leadingIcon}
      {children}
    </button>
  )
})

function Spinner() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-spin">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity=".25" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  )
}

const BASE =
  'inline-flex items-center justify-center gap-sm rounded-md font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-60'

const VARIANT = {
  primary: 'bg-brand-primary text-brand-onPrimary hover:bg-brand-primaryHover',
  secondary: 'border border-border-base bg-surface-base text-text-primary hover:bg-surface-raised',
  ghost: 'text-text-primary hover:bg-surface-raised',
  danger: 'bg-status-danger text-brand-onPrimary hover:opacity-90',
} as const

const SIZE = {
  sm: 'px-sm py-xs text-sm',
  md: 'px-md py-sm text-base',
  lg: 'px-lg py-md text-lg',
} as const
