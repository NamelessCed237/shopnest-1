import type {
  Category,
  CategoryWithCounts,
  CreateCategoryInput,
  CursorPage,
  UpdateCategoryInput,
} from '@shopnest/contracts'
import type { ApiClient, RequestOptions } from '../client.js'

export function categoriesEndpoints(client: ApiClient) {
  return {
    /**
     * Renvoie un TABLEAU, alors que la route sert une page.
     *
     * L'arbre est borné à deux niveaux et jamais paginé : l'écran de gestion
     * veut une liste, pas un curseur. La forme paginée existe côté HTTP pour le
     * résolveur d'entités générique (doc/07 §3.1), qui alimente toutes les
     * listes déroulantes en lisant `items` — on la déballe ici plutôt que dans
     * chaque appelant.
     */
    list: async (
      query: { search?: string } = {},
      options?: RequestOptions,
    ): Promise<CategoryWithCounts[]> => {
      const page = await client.get<CursorPage<CategoryWithCounts>>(
        '/categories',
        query,
        options,
      )
      return page.items
    },

    detail: (id: string, options?: RequestOptions) =>
      client.get<CategoryWithCounts>(`/categories/${id}`, undefined, options),

    create: (input: CreateCategoryInput, options?: RequestOptions) =>
      client.post<Category>('/categories', input, options),

    update: (id: string, input: UpdateCategoryInput, options?: RequestOptions) =>
      client.patch<Category>(`/categories/${id}`, input, options),

    remove: (id: string, options?: RequestOptions) =>
      client.delete<{ id: string }>(`/categories/${id}`, options),
  }
}
