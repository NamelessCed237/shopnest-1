import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'
import { Icon } from '../icon/Icon.js'

export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> {
  label?: string
  helperText?: string
  error?: string
  size?: 'sm' | 'md' | 'lg'
  /** Ajoute un bouton afficher/masquer — le champ reste `type=password` par défaut. */
  revealable?: boolean
}

/**
 * doc/04 §8 — un <label> associé, pas seulement un placeholder ; l'erreur est
 * reliée par aria-describedby et annoncée par role="alert".
 */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, helperText, error, size = 'md', revealable = false, required, type = 'text', ...rest },
  ref,
) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const describedBy = error ? `${id}-error` : helperText ? `${id}-helper` : undefined
  const effectiveType = revealable && revealed ? 'text' : type

  return (
    <div className="flex flex-col gap-xs">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text-primary">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-xs text-status-danger">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={effectiveType}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(BASE, SIZE[size], {
            'border-status-danger': Boolean(error),
            'pe-2xl': revealable,
          })}
          {...rest}
        />

        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-pressed={revealed}
            aria-label={revealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="absolute inset-y-0 end-0 px-sm text-sm text-text-secondary"
          >
            <Icon name={revealed ? 'eye-off' : 'eye'} />
          </button>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-status-danger">
          {error}
        </p>
      ) : (
        helperText && (
          <p id={`${id}-helper`} className="text-xs text-text-secondary">
            {helperText}
          </p>
        )
      )}
    </div>
  )
})

const BASE =
  'w-full rounded-md border border-border-base bg-surface-base text-text-primary outline-none placeholder:text-text-disabled focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-60'

const SIZE = {
  sm: 'px-sm py-xs text-sm',
  md: 'px-md py-sm text-base',
  lg: 'px-md py-md text-lg',
} as const
