import type { Product, ProductVariant } from '@shopnest/contracts'

/**
 * Ligne Prisma → contrat.
 *
 * doc/06 §2 — la base et le contrat ne représentent PAS l'argent de la même
 * façon, et c'est délibéré : PostgreSQL stocke `price_cents` + `currency` à
 * plat, deux colonnes indexables ; le contrat expose un objet `Money`
 * indissociable, pour qu'aucun montant ne puisse circuler sans sa devise.
 *
 * Sans cette traduction explicite, l'API renvoie la ligne brute : le client
 * reçoit `price: undefined` et tombe au premier accès à `price.currency`.
 * L'erreur ne se voit qu'à l'exécution, puisque le repository renvoie un type
 * Prisma que rien ne confronte au contrat — d'où ce point de passage unique.
 *
 * Il retire aussi `tenantId` et `deletedAt` : des détails d'implémentation que
 * le client n'a aucune raison de connaître.
 */

interface VariantRow {
  id: string
  sku: string
  name: string
  priceCents: number
  stock: number
  attributes: unknown
}

interface ProductRow {
  id: string
  slug: string
  name: string
  description: string
  priceCents: number
  currency: string
  status: string
  stock: number
  lowStockThreshold: number
  imageUrls: string[]
  createdAt: Date
  updatedAt: Date
  variants?: VariantRow[]
  categories?: { id: string }[]
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    price: { amountCents: row.priceCents, currency: row.currency },
    status: row.status as Product['status'],
    stock: row.stock,
    lowStockThreshold: row.lowStockThreshold,
    imageUrls: row.imageUrls,
    // `categories` n'est chargée que sur le détail ; sur la liste, renvoyer un
    // tableau vide est exact — c'est « non chargé », pas « aucune catégorie »,
    // et aucun écran ne s'en sert pour décider d'une écriture.
    categoryIds: (row.categories ?? []).map((category) => category.id),
    variants: (row.variants ?? []).map((variant) => toVariant(variant, row.currency)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Une variante n'a pas de devise propre en base : elle hérite de celle du
 * produit. Deux prix d'un même produit dans deux devises n'auraient pas de
 * sens — et rendraient `derivePrice` impossible à calculer.
 */
function toVariant(row: VariantRow, currency: string): ProductVariant {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    price: { amountCents: row.priceCents, currency },
    stock: row.stock,
    attributes: (row.attributes ?? {}) as Record<string, string>,
  }
}
