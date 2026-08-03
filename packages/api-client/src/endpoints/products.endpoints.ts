import type {
  CreateProductInput,
  CreateVariantInput,
  CursorPage,
  ListProductsQuery,
  Product,
  UpdateProductInput,
  UpdateVariantInput,
} from '@shopnest/contracts'
import type { ApiClient, RequestOptions } from '../client.js'

export function productsEndpoints(client: ApiClient) {
  return {
    list: (query: Partial<ListProductsQuery>, options?: RequestOptions) =>
      client.get<CursorPage<Product>>('/products', query, options),

    detail: (id: string, options?: RequestOptions) =>
      client.get<Product>(`/products/${id}`, undefined, options),

    create: (input: CreateProductInput, options?: RequestOptions) =>
      client.post<Product>('/products', input, options),

    update: (id: string, input: UpdateProductInput, options?: RequestOptions) =>
      client.patch<Product>(`/products/${id}`, input, options),

    /**
     * Variantes — doc §10.1 du cahier des charges.
     *
     * Les trois renvoient le PRODUIT complet et non la variante : ajouter ou
     * retirer une variante change le stock et le prix dérivés du produit
     * (`deriveStock` / `derivePrice`), et le client ne doit pas avoir à
     * recalculer une règle métier qui vit dans le contrat.
     */
    addVariant: (productId: string, input: CreateVariantInput, options?: RequestOptions) =>
      client.post<Product>(`/products/${productId}/variants`, input, options),

    updateVariant: (
      productId: string,
      variantId: string,
      input: UpdateVariantInput,
      options?: RequestOptions,
    ) => client.patch<Product>(`/products/${productId}/variants/${variantId}`, input, options),

    removeVariant: (productId: string, variantId: string, options?: RequestOptions) =>
      client.delete<Product>(`/products/${productId}/variants/${variantId}`, options),

    /**
     * Archivage (soft delete) — doc/03 §4.
     *
     * Renvoie le produit mis à jour et non `void` : le client doit rafraîchir
     * son cache avec l'état réel, et un `void` l'obligerait à deviner.
     */
    archive: (id: string, options?: RequestOptions) =>
      client.delete<Product>(`/products/${id}`, options),
  }
}
