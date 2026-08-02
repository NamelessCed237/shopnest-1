/**
 * Types de base du contrat de composants dynamiques — doc/07 §3.1.
 *
 * Ils vivent dans `contracts` et non dans `core` parce que `api-client` en a besoin
 * (createEntityResolver) et que `api-client` ne peut pas dépendre de `core` :
 * ce serait un cycle. Voir le graphe de doc/01 §4.
 */

export interface Option<T = string> {
  value: T
  label: string
  description?: string
  disabled?: boolean
  /** Regroupement visuel dans la liste. */
  group?: string
  /** L'entité d'origine, si l'appelant en a besoin dans renderOption. */
  raw?: unknown
}

export interface FetchOptionsParams {
  /** Terme de recherche saisi par l'utilisateur — déjà debouncé. */
  search: string
  /** Curseur de pagination — undefined pour la première page. */
  cursor?: string
  /** Valeurs des champs dont dépend cette source, ex. { countryId: 'fr' }. */
  deps: Record<string, unknown>
  signal: AbortSignal
}

export interface FetchOptionsResult<T = string> {
  options: Option<T>[]
  nextCursor?: string
  total?: number
}

export type FetchOptionsFn<T = string> = (
  params: FetchOptionsParams,
) => Promise<FetchOptionsResult<T>>

export const OPTION_ENTITIES = [
  'products',
  'categories',
  'customers',
  'tenants',
  'plans',
  'countries',
  'tags',
] as const
export type OptionEntity = (typeof OPTION_ENTITIES)[number]
