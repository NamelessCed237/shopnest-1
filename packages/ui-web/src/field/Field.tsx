import { useId, type ReactNode } from 'react'

/**
 * doc/04 §8 — tout champ a un <label> associé, pas seulement un placeholder,
 * et son message d'erreur est relié par aria-describedby.
 */
export interface FieldProps {
  label?: string
  helperText?: string
  error?: string
  required?: boolean
  children: ReactNode
}

export function Field({ label, helperText, error, required, children }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : helperText ? `${id}-helper` : undefined

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

      <div id={id} aria-describedby={describedBy}>
        {children}
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
}
