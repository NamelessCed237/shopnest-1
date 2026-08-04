import type { ReactNode } from 'react'

export interface RankedRow {
  id: string
  label: string
  /** Valeur brute qui sert au dimensionnement de la barre. */
  weight: number
  /** Valeur déjà formatée — le composant ne formate jamais un montant. */
  value: string
  hint?: string
}

export interface RankedBarListProps {
  rows: RankedRow[]
  empty: ReactNode
}

/**
 * Classement à barres proportionnelles.
 *
 * Les trois ventilations de l'écran statistiques ont la même forme — un
 * libellé, une valeur, une barre. Trois implémentations divergeraient au
 * premier ajustement d'espacement.
 *
 * La barre est mise à l'échelle du MAXIMUM de la liste, et non du total.
 * Rapporter au total écrase visuellement toute liste un peu longue : avec dix
 * lignes équilibrées, aucune barre ne dépasse 10 % de la largeur et le
 * classement devient illisible. À l'échelle du maximum, le premier remplit la
 * ligne et les suivants se comparent à lui — ce qu'on cherche à lire ici.
 */
export function RankedBarList({ rows, empty }: RankedBarListProps) {
  if (rows.length === 0) return <>{empty}</>

  const max = Math.max(...rows.map((row) => row.weight), 1)

  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-xs px-md py-sm">
          <div className="flex items-baseline justify-between gap-md">
            <span className="truncate text-sm text-text-primary">{row.label}</span>
            <span className="shrink-0 text-sm font-medium tabular-nums text-text-primary">
              {row.value}
            </span>
          </div>

          <div className="flex items-center gap-sm">
            {/*
              `role="presentation"` : la barre ne porte aucune information que
              le couple libellé + valeur ci-dessus ne donne déjà. L'annoncer une
              seconde fois alourdirait la lecture au lecteur d'écran.
            */}
            <div
              role="presentation"
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken"
            >
              <div
                className="h-full rounded-full bg-brand-primary"
                style={{ width: `${Math.max((row.weight / max) * 100, 2)}%` }}
              />
            </div>
            {row.hint && (
              <span className="shrink-0 text-xs tabular-nums text-text-secondary">{row.hint}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
