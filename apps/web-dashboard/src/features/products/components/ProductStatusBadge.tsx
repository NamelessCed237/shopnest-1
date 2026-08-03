import type { ProductStatus } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Badge } from '@shopnest/ui-web'

const VARIANT = {
  active: 'success',
  draft: 'neutral',
  archived: 'warning',
} as const satisfies Record<ProductStatus, 'success' | 'neutral' | 'warning'>

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const { t } = useTranslation()
  return <Badge variant={VARIANT[status]}>{t(`products.status.${status}`)}</Badge>
}
