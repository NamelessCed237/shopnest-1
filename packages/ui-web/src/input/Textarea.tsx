import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  label?: string
  helperText?: string
  error?: string
  /** Compteur de caractères — affiché seulement si une limite est donnée. */
  maxLength?: number
  value?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helperText, error, required, maxLength, value, rows = 4, ...rest },
  ref,
) {
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

      <textarea
        ref={ref}
        id={id}
        rows={rows}
        required={required}
        maxLength={maxLength}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(
          'w-full rounded-md border border-border-base bg-surface-base px-md py-sm text-base text-text-primary outline-none placeholder:text-text-disabled focus-visible:ring-2 focus-visible:ring-border-focus',
          { 'border-status-danger': Boolean(error) },
        )}
        {...rest}
      />

      <div className="flex justify-between gap-sm">
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-xs text-status-danger">
            {error}
          </p>
        ) : (
          <p id={`${id}-helper`} className="text-xs text-text-secondary">
            {helperText}
          </p>
        )}

        {maxLength !== undefined && (
          <span className="shrink-0 text-xs tabular-nums text-text-secondary">
            {(value ?? '').length} / {maxLength}
          </span>
        )}
      </div>
    </div>
  )
})
