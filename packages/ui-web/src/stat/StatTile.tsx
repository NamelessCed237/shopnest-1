import type { ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export interface StatTileProps {
  label: string
  /** Valeur déjà formatée par l'appelant (montant, nombre) — jamais formatée ici. */
  value: string
  /** Variation relative, ex. 0.124. `null` = pas de période de comparaison. */
  delta?: number | null
  /** Vrai si une hausse est une mauvaise nouvelle (ruptures de stock, échecs). */
  invertDelta?: boolean
  hint?: string
  loading?: boolean
  icon?: ReactNode
}

/**
 * doc dataviz — une valeur unique n'est PAS un graphique à une barre.
 * La tuile porte le chiffre, sa variation, et rien d'autre.
 */
export function StatTile({
  label,
  value,
  delta,
  invertDelta = false,
  hint,
  loading = false,
  icon,
}: StatTileProps) {
  return (
    <div className="flex flex-col gap-xs rounded-lg border border-border-base bg-surface-base p-md">
      <div className="flex items-center justify-between gap-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          {label}
        </span>
        {icon}
      </div>

      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded-sm bg-surface-sunken" />
      ) : (
        <span className="text-2xl font-semibold tabular-nums text-text-primary">{value}</span>
      )}

      {!loading && delta !== undefined && <DeltaBadge delta={delta} inverted={invertDelta} />}
      {!loading && hint && <span className="text-xs text-text-secondary">{hint}</span>}
    </div>
  )
}

function DeltaBadge({ delta, inverted }: { delta: number | null; inverted: boolean }) {
  // Pas de période de comparaison : on n'invente pas « +100 % ».
  if (delta === null) {
    return <span className="text-xs text-text-disabled">—</span>
  }

  const isUp = delta >= 0
  const isGood = inverted ? !isUp : isUp
  const percent = `${isUp ? '+' : ''}${(delta * 100).toFixed(1).replace('.', ',')} %`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-xs text-xs font-medium tabular-nums',
        isGood ? 'text-status-success' : 'text-status-danger',
      )}
    >
      {/* Flèche + signe : la couleur seule ne porte jamais l'information. */}
      <span aria-hidden="true">{isUp ? '▲' : '▼'}</span>
      {percent}
    </span>
  )
}
