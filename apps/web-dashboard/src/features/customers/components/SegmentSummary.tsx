import { CUSTOMER_SEGMENTS, type CustomerSegment } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { StatTile } from '@shopnest/ui-web'
import { useCustomerSegments } from '../api/use-customers'

/**
 * skill dataviz — quatre effectifs se lisent en RANGÉE DE TUILES, pas en
 * camembert : comparer des parts sur un disque est moins précis qu'un nombre,
 * et les segments sont aussi un filtre, pas seulement une répartition.
 */
export function SegmentSummary({
  activeSegment,
  onSelect,
}: {
  activeSegment?: CustomerSegment
  onSelect: (segment: CustomerSegment | undefined) => void
}) {
  const { t, number } = useTranslation()
  const query = useCustomerSegments()

  return (
    <div className="grid grid-cols-2 gap-md xl:grid-cols-4">
      {CUSTOMER_SEGMENTS.map((segment) => {
        const isActive = activeSegment === segment
        return (
          <button
            key={segment}
            type="button"
            // Un second clic sur la tuile active retire le filtre : sans cela,
            // l'utilisateur est piégé et doit chercher « Réinitialiser ».
            onClick={() => onSelect(isActive ? undefined : segment)}
            aria-pressed={isActive}
            className={`rounded-lg text-start outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-border-focus ${
              isActive ? 'ring-2 ring-brand-primary' : 'hover:shadow-sm'
            }`}
          >
            <StatTile
              label={t(`customers.segment.${segment}`)}
              value={query.data ? number(query.data[segment]) : '—'}
              loading={query.isPending}
              hint={t(`customers.segment.${segment}.hint`)}
            />
          </button>
        )
      })}
    </div>
  )
}
