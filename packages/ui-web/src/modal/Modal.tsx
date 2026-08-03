import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '../lib/cn.js'

export interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** Boutons d'action — alignés à droite, action principale en dernier. */
  footer?: ReactNode
  size?: 'sm' | 'md'
}

/**
 * doc/04 §8 — Radix fournit le piège à focus, la fermeture par Échap, le retour
 * du focus au déclencheur et `aria-modal`. On n'écrit que le rendu : réimplémenter
 * ce comportement à la main, c'est le réimplémenter à moitié.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'sm',
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-overlay bg-surface-overlay" />

        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-modal w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border-base bg-surface-base shadow-lg',
            size === 'sm' ? 'max-w-md' : 'max-w-2xl',
          )}
        >
          <div className="flex flex-col gap-xs border-b border-border-base p-md">
            <Dialog.Title className="text-base font-semibold text-text-primary">
              {title}
            </Dialog.Title>
            {description && (
              <Dialog.Description className="text-sm text-text-secondary">
                {description}
              </Dialog.Description>
            )}
          </div>

          <div className="p-md">{children}</div>

          {footer && (
            <div className="flex flex-wrap justify-end gap-sm border-t border-border-base p-md">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
