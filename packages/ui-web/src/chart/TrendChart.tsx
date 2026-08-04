import { useId, useMemo, useState } from 'react'

/**
 * Graphique d'évolution — série UNIQUE.
 *
 * Choix de forme (skill dataviz) : le travail de la donnée est « tendance dans le
 * temps » avec une seule mesure → ligne + aire, pas de palette catégorielle, donc
 * PAS de légende (le titre de la carte nomme la série ; un encart à une pastille
 * ne ferait que répéter le titre).
 *
 * Specs de marque respectées : ligne 2px, aire à ~10 % d'opacité, marqueur ≥ 8px
 * avec anneau de 2px en couleur de surface, grille en filet 1px continu et
 * récessive, étiquetage sélectif (extrémité seulement), et couche de survol
 * (crosshair + infobulle) fournie par défaut.
 */

export interface TrendPoint {
  /** Clé de l'axe X, déjà formatée pour l'infobulle (ex. « 12 juil. »). */
  label: string
  value: number
  /** Valeur affichée dans l'infobulle — formatée par l'appelant (devise, etc.). */
  display: string
}

export interface TrendChartProps {
  points: TrendPoint[]
  /** Décrit la série pour les lecteurs d'écran, puisqu'il n'y a pas de légende. */
  ariaLabel: string
  height?: number
  /** Étiquettes de l'axe Y — l'appelant les formate (devise abrégée, etc.). */
  formatTick?: (value: number) => string
  emptyLabel?: string
}

const PADDING = { top: 16, right: 16, bottom: 24, left: 48 }
const VIEW_WIDTH = 720

/**
 * Gouttière gauche ADAPTÉE aux étiquettes de l'axe.
 *
 * Elle était fixée à 48 unités. Suffisant pour « 10 000 € », pas pour
 * « 10 M FCFA » : le libellé est ancré à droite, donc il débordait vers la
 * gauche du cadre et se retrouvait rogné — on lisait « 000 000 ». Le cas n'est
 * pas exotique, c'est celui des devises sans décimales, soit le marché visé.
 *
 * 6,5 unités par caractère est une borne HAUTE pour la police de 11 px du
 * graphique : mieux vaut quelques unités perdues qu'une étiquette coupée. Le
 * plafond évite qu'une devise très verbeuse ne mange la moitié du tracé.
 */
function gutterFor(labels: string[]): number {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0)
  return Math.min(Math.max(PADDING.left, longest * 6.5 + 12), 120)
}

export function TrendChart({
  points,
  ariaLabel,
  height = 220,
  formatTick,
  emptyLabel = 'Aucune donnée sur la période',
}: TrendChartProps) {
  const gradientId = useId()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const geometry = useMemo(() => {
    if (points.length === 0) return null

    const maxValue = Math.max(...points.map((p) => p.value))
    // Échelle toujours ancrée à zéro : démarrer au minimum exagère les variations.
    const scaleMax = niceCeil(maxValue || 1)
    const ticks = [0, scaleMax / 2, scaleMax]

    // La gouttière dépend des étiquettes, donc du formateur de l'appelant : on
    // la calcule AVANT toute géométrie qui en dépend.
    const left = gutterFor(ticks.map((tick) => formatTick?.(tick) ?? String(tick)))

    const innerWidth = VIEW_WIDTH - left - PADDING.right
    const innerHeight = height - PADDING.top - PADDING.bottom

    const x = (index: number) =>
      left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth)
    const y = (value: number) => PADDING.top + innerHeight - (value / scaleMax) * innerHeight

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ')
    const areaPath = `${linePath} L ${x(points.length - 1)} ${PADDING.top + innerHeight} L ${x(0)} ${PADDING.top + innerHeight} Z`

    return { x, y, linePath, areaPath, ticks, scaleMax, innerHeight, left }
  }, [points, height, formatTick])

  if (!geometry) {
    return (
      <p className="py-lg text-center text-sm text-text-secondary">{emptyLabel}</p>
    )
  }

  const lastIndex = points.length - 1
  const active = hoverIndex ?? lastIndex
  const activePoint = points[active]

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        className="w-full"
        role="img"
        aria-label={ariaLabel}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const ratio = (event.clientX - rect.left) / rect.width
          const svgX = ratio * VIEW_WIDTH
          const inner = VIEW_WIDTH - geometry.left - PADDING.right
          const index = Math.round(((svgX - geometry.left) / inner) * (points.length - 1))
          setHoverIndex(Math.min(Math.max(index, 0), lastIndex))
        }}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            {/* Aire : lavis à ~10 %, jamais un aplat saturé. */}
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grille récessive : filet 1px continu, jamais en pointillés. */}
        <g className="text-border-base">
          {geometry.ticks.map((tick) => (
            <line
              key={tick}
              x1={geometry.left}
              x2={VIEW_WIDTH - PADDING.right}
              y1={geometry.y(tick)}
              y2={geometry.y(tick)}
              stroke="currentColor"
              strokeWidth="1"
            />
          ))}
        </g>

        <g className="fill-text-secondary text-[11px]">
          {geometry.ticks.map((tick) => (
            <text key={tick} x={geometry.left - 8} y={geometry.y(tick) + 4} textAnchor="end">
              {formatTick?.(tick) ?? Math.round(tick).toLocaleString('fr-FR')}
            </text>
          ))}
        </g>

        <g className="text-brand-primary">
          <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
          <path
            d={geometry.linePath}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Crosshair — couche de survol fournie par défaut, pas en option. */}
          {hoverIndex !== null && (
            <line
              x1={geometry.x(active)}
              x2={geometry.x(active)}
              y1={PADDING.top}
              y2={PADDING.top + geometry.innerHeight}
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.4"
            />
          )}

          {/* Marqueur : r ≥ 4 avec anneau 2px en couleur de surface. */}
          <circle
            cx={geometry.x(active)}
            cy={geometry.y(points[active]?.value ?? 0)}
            r="5"
            fill="currentColor"
            className="stroke-surface-base"
            strokeWidth="2"
          />
        </g>

        {/* Étiquetage SÉLECTIF : uniquement les bornes de l'axe X. */}
        <g className="fill-text-secondary text-[11px]">
          <text x={geometry.left} y={height - 6} textAnchor="start">
            {points[0]?.label}
          </text>
          <text x={VIEW_WIDTH - PADDING.right} y={height - 6} textAnchor="end">
            {points[lastIndex]?.label}
          </text>
        </g>
      </svg>

      {activePoint && (
        <div
          className="pointer-events-none absolute top-0 flex gap-sm whitespace-nowrap rounded-md border border-border-base bg-surface-base px-sm py-xs text-xs shadow-sm"
          /*
           * L'ANCRAGE change près des bords.
           *
           * Centrée sur le point (`translateX(-50%)`), l'infobulle du dernier
           * point débordait de la moitié de sa largeur hors du cadre : sur le
           * point le plus à droite — celui qu'on survole en premier, puisque
           * c'est le plus récent — elle sortait de l'écran.
           *
           * On bascule donc l'ancrage plutôt que de mesurer sa largeur : à
           * droite elle s'aligne par la droite, à gauche par la gauche, et
           * reste centrée entre les deux.
           */
          style={tooltipAnchor((geometry.x(active) / VIEW_WIDTH) * 100)}
          role="status"
        >
          <span className="text-text-secondary">{activePoint.label}</span>
          <span className="font-medium tabular-nums text-text-primary">{activePoint.display}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Position de l'infobulle selon la proximité d'un bord.
 *
 * Le seuil de 15 % est empirique mais sûr : au-delà, une infobulle de largeur
 * raisonnable tient centrée dans le cadre à toutes les tailles d'écran testées.
 */
function tooltipAnchor(percent: number): React.CSSProperties {
  if (percent > 85) return { right: `${100 - percent}%` }
  if (percent < 15) return { left: `${percent}%` }
  return { left: `${percent}%`, transform: 'translateX(-50%)' }
}

/** Arrondit le plafond de l'axe à une valeur lisible (1, 2, 5 × 10^n). */
function niceCeil(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}
