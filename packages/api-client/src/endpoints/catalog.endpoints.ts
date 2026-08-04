import type {
  CursorPage,
  ListProductsQuery,
  Product,
  ProductVariant,
} from '@shopnest/contracts'
import type { ApiClient, RequestOptions } from '../client.js'

/**
 * Produit tel que le voit un VISITEUR.
 *
 * Le stock exact et le seuil d'alerte sont absents — pas masqués à
 * l'affichage : ils ne quittent pas le serveur. « Plus que 2 en stock »
 * renseigne surtout la concurrence sur le volume d'affaires de la boutique.
 */
export type PublicVariant = Omit<ProductVariant, 'stock'> & { inStock: boolean }

export type PublicProduct = Omit<Product, 'stock' | 'lowStockThreshold' | 'variants'> & {
  inStock: boolean
  variants: PublicVariant[]
}

export interface PublicCategory {
  id: string
  name: string
  slug: string
  position: number
}

export function catalogEndpoints(client: ApiClient) {
  return {
    list: (query: Partial<ListProductsQuery>, options?: RequestOptions) =>
      client.get<CursorPage<PublicProduct>>('/catalog/products', query, options),

    /**
     * Par SLUG et non par identifiant : c'est l'URL que l'acheteur partage et
     * que les moteurs indexent.
     */
    detail: (slug: string, options?: RequestOptions) =>
      client.get<PublicProduct>(`/catalog/products/${slug}`, undefined, options),

    categories: (options?: RequestOptions) =>
      client.get<{ items: PublicCategory[] }>('/catalog/categories', undefined, options),
  }
}
