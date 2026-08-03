import type { Category, CategoryWithCounts } from '@shopnest/contracts'

interface CategoryRow {
  id: string
  slug: string
  name: string
  description: string
  parentId: string | null
  position: number
}

/**
 * `parentId` : `null` en base, ABSENT dans le contrat.
 *
 * Le schéma zod déclare `parentId` optionnel, pas nullable : renvoyer `null`
 * ferait échouer la validation côté client. La distinction paraît byzantine,
 * elle ne l'est pas — « pas de parent » et « parent inconnu » doivent rester
 * indiscernables pour l'appelant.
 */
export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    ...(row.parentId ? { parentId: row.parentId } : {}),
    position: row.position,
  }
}

export function toCategoryWithCounts(
  row: CategoryRow & { _count?: { products: number } },
  childCount: number,
): CategoryWithCounts {
  return {
    ...toCategory(row),
    productCount: row._count?.products ?? 0,
    childCount,
  }
}
