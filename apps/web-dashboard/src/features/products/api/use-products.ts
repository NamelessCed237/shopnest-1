import { useInfiniteQuery } from '@tanstack/react-query'
import { productKeys } from '@shopnest/api-client'
import type { AppError, CursorPage, ListProductsQuery, Product } from '@shopnest/contracts'
import { api } from '@/lib/api'

export type ProductFilters = Pick<
  ListProductsQuery,
  'search' | 'status' | 'categoryId' | 'sortBy' | 'sortOrder'
>

/**
 * doc/04 §4 — la clé de cache est centralisée dans @shopnest/api-client.
 * Une clé écrite à la main dans un composant rend l'invalidation impossible
 * à maintenir le jour où une mutation doit rafraîchir cette liste.
 */
export function useProducts(filters: ProductFilters) {
  return useInfiniteQuery<CursorPage<Product>, AppError>({
    queryKey: productKeys.list(filters),
    queryFn: ({ pageParam, signal }) =>
      api.products.list(
        { ...filters, cursor: pageParam as string | undefined, limit: 20 },
        { signal },
      ),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Pas de flash d'écran vide en changeant de filtre : on garde la page
    // précédente affichée pendant le chargement de la suivante (doc/04 §4).
    placeholderData: (previous) => previous,
  })
}
