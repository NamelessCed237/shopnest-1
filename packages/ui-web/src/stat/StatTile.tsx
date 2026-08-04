import type { ReactNode } from 'react'
import { Icon } from '../icon/Icon.js'
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
    /*
     * Ombre douce PLUTÔT qu'une bordure marquée.
     *
     * Une bordure de 1 px sur chaque tuile dessine une grille de traits qui
     * attire l'œil avant les chiffres. L'ombre suggère le même relief sans rien
     * tracer — et une bordure très pâle suffit à garder la tuile lisible en
     * contraste élevé, où les ombres sont souvent supprimées.
     */
    /*
     * `min-w-0` : sans lui, une tuile placée dans une grille refuse de
     * rétrécir sous la largeur de son contenu (`min-width: auto` est la valeur
     * initiale des éléments de grille). Le débordement remontait alors jusqu'à
     * la page, qui gagnait une barre de défilement horizontale.
     */
    <div
      /*
       * La tuile se déclare CONTENEUR : c'est ce qui donne un sens à l'unité
       * `cqi` du chiffre ci-dessous, qui se dimensionne alors sur la largeur
       * de la tuile et non sur celle de la fenêtre.
       *
       * En style inline plutôt qu'en classe utilitaire : `container-type`
       * exige le plugin `@tailwindcss/container-queries`, une dépendance de
       * plus pour une seule propriété posée à un seul endroit.
       */
      style={{ containerType: 'inline-size' }}
      className="flex min-w-0 flex-col gap-sm rounded-lg border border-border-base/60 bg-surface-base p-md shadow-sm"
    >
      <div className="flex items-center justify-between gap-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          {label}
        </span>
        {/* Pastille discrète : l'icône situe la tuile sans concurrencer le chiffre. */}
        {icon && (
          <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-primarySubtle text-brand-primary">
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-9 w-28 animate-pulse rounded-sm bg-surface-sunken" />
      ) : (
        /*
         * La taille du chiffre SUIT LA LARGEUR DE LA TUILE, via `cqi` — une
         * unité relative au conteneur déclaré plus haut.
         *
         * Trois réponses possibles à un montant trop long, deux mauvaises :
         *   · le tronquer — « FCFA 24,742,75 » se lit comme une autre valeur ;
         *   · le renvoyer à la ligne — la coupure tombe entre deux chiffres et
         *     laisse le « 0 » final seul sur la seconde ligne ;
         *   · le réduire jusqu'à ce qu'il tienne. Seule celle-ci préserve la
         *     valeur.
         *
         * Le cas n'est pas marginal : les devises sans décimales — franc CFA,
         * soit le marché visé — comptent trois chiffres de plus qu'un euro à
         * valeur égale.
         *
         * En CSS et non en JavaScript : une mesure au montage aurait exigé un
         * ResizeObserver pour suivre les changements de largeur, là où le
         * moteur de rendu recalcule `cqi` à chaque passe de mise en page,
         * sans écouteur ni risque de boucle.
         *
         * 12 cqi : sur une tuile de 200 px cela donne 24 px, où « FCFA 24 742 750 »
         * occupe environ 85 % de la largeur — de quoi absorber un ordre de
         * grandeur de plus, ou une devise au libellé plus long. Bornes prises sur l'échelle de tokens
         * (`lg` = 18 px, `3xl` = 40 px).
         */
        <span className="block whitespace-nowrap text-[clamp(1.125rem,12cqi,2.5rem)] font-semibold leading-tight tracking-tight tabular-nums text-text-primary">
          {value}
        </span>
      )}

      {!loading && (delta !== undefined || hint) && (
        <div className="flex flex-wrap items-center gap-xs">
          {delta !== undefined && <DeltaBadge delta={delta} inverted={invertDelta} />}
          {hint && <span className="text-xs text-text-secondary">{hint}</span>}
        </div>
      )}
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
        'inline-flex items-center gap-[2px] rounded-full px-xs py-[1px] text-xs font-medium tabular-nums',
        // Fond teinté plutôt que du texte coloré nu : la variation se lit alors
        // comme une étiquette rattachée au chiffre, pas comme une seconde
        // valeur qui lui dispute l'attention.
        isGood ? 'bg-status-success/10 text-status-success' : 'bg-status-danger/10 text-status-danger',
      )}
    >
      {/* Flèche ET signe : la couleur seule ne porte jamais l'information. */}
      <Icon name={isUp ? 'sort-asc' : 'sort-desc'} size="sm" />
      {percent}
    </span>
  )
}
