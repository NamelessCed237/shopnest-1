import type { CursorPage, FetchOptionsFn, Option } from '@shopnest/contracts'
import type { ApiClient } from './client.js'

/**
 * doc/07 §3.1 — résout une source de type `{ entity: 'products' }` en fonction de fetch.
 *
 * C'est le raccourci déclaratif qui permet d'écrire :
 *     <Dropdown source={{ entity: 'categories' }} />
 * sans que le composant ni l'appelant ne connaissent le détail HTTP.
 */

interface NamedEntity {
  id: string
  name?: string
  label?: string
  slug?: string
}

const ENTITY_PATHS: Record<string, string> = {
  products: '/products',
  categories: '/categories',
  customers: '/customers',
  tenants: '/admin/tenants',
  plans: '/plans',
  countries: '/reference/countries',
  tags: '/tags',
}

export function createEntityResolver(client: ApiClient) {
  return (entity: string, params?: Record<string, unknown>): FetchOptionsFn => {
    const path = ENTITY_PATHS[entity]
    if (!path) throw new Error(`Entité inconnue pour une OptionSource : ${entity}`)

    return async ({ search, cursor, deps, signal }) => {
      const page = await client.get<CursorPage<NamedEntity>>(
        path,
        { ...params, ...deps, search, cursor, limit: 20 },
        { signal },
      )

      return {
        options: page.items.map(
          (item): Option => ({
            value: item.id,
            label: item.name ?? item.label ?? item.slug ?? item.id,
            raw: item,
          }),
        ),
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
        ...(page.total !== undefined ? { total: page.total } : {}),
      }
    }
  }
}
