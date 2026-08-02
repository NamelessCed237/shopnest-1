import type {
  CreateProductInput,
  CursorPage,
  ListProductsQuery,
  Product,
  UpdateProductInput,
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

    archive: (id: string, options?: RequestOptions) =>
      client.delete<void>(`/products/${id}`, options),
  }
}
