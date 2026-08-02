import type { ReactNode } from 'react'

/**
 * doc/04 §7 — un état vide explique et propose une action.
 * Une liste vide sans message est un bug d'expérience, pas un cas non couvert.
 */
export function EmptyState({
  search,
  title,
  action,
}: {
  search?: string
  title?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-sm p-md text-center">
      <p className="text-sm text-text-secondary">
        {title ?? (search ? `Aucun résultat pour « ${search} »` : 'Aucun élément')}
      </p>
      {action}
    </div>
  )
}
