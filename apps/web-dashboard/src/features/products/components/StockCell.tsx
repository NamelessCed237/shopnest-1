import type { Product } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Badge } from '@shopnest/ui-web'

/**
 * Le seuil vient du produit, pas d'une constante d'affichage : c'est une donnée
 * métier que le vendeur configure par produit (doc/01 — pas de règle en dur côté UI).
 */
export function StockCell({ product }: { product: Product }) {
  const { t, number } = useTranslation()

  if (product.stock === 0) {
    return <Badge variant="danger">{t('products.stock.out')}</Badge>
  }

  if (product.stock <= product.lowStockThreshold) {
    return <Badge variant="warning">{t('products.stock.low', { count: product.stock })}</Badge>
  }

  return <span>{number(product.stock)}</span>
}
