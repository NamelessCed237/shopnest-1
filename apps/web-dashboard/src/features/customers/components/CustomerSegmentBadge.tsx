import type { CustomerSegment } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Badge } from '@shopnest/ui-web'

/**
 * `dormant` en warning et non en danger : un client qui n'a pas commandé depuis
 * 90 jours est une opportunité de relance, pas une erreur. Réserver le rouge
 * aux vrais incidents garde son pouvoir d'alerte (skill dataviz — statuts).
 */
const VARIANT = {
  new: 'info',
  returning: 'success',
  loyal: 'success',
  dormant: 'warning',
} as const satisfies Record<CustomerSegment, 'info' | 'success' | 'warning'>

export function CustomerSegmentBadge({ segment }: { segment: CustomerSegment }) {
  const { t } = useTranslation()
  return <Badge variant={VARIANT[segment]}>{t(`customers.segment.${segment}`)}</Badge>
}
