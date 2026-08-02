import type {
  FetchOptionsFn,
  Option,
  OptionEntity,
} from '@shopnest/contracts'

/**
 * doc/07 §3.1 — L'ABSTRACTION CENTRALE du contrat de composants.
 *
 * Un composant reçoit une SOURCE de données, jamais des données.
 * Les quatre formes ci-dessous sont indiscernables du point de vue du composant :
 * c'est ce qui évite d'avoir onze variantes de Dropdown dans six mois.
 *
 * Les types de base (Option, FetchOptions*) vivent dans @shopnest/contracts —
 * `api-client` en a besoin et ne peut pas dépendre de `core` (cycle).
 */

export type {
  Option,
  OptionEntity,
  FetchOptionsFn,
  FetchOptionsParams,
  FetchOptionsResult,
} from '@shopnest/contracts'

export interface QueryOptionSource<T = string> {
  queryKey: readonly unknown[]
  queryFn: FetchOptionsFn<T>
  staleTime?: number
}

export interface EntityOptionSource<T = string> {
  entity: OptionEntity
  /** Filtres additionnels transmis à l'API. */
  params?: Record<string, unknown>
  /** Projection entité → option. Par défaut : { value: id, label: name }. */
  map?: (entity: never) => Option<T>
}

/** Les quatre formes qu'une source peut prendre. */
export type OptionSource<T = string> =
  | Option<T>[]
  | FetchOptionsFn<T>
  | QueryOptionSource<T>
  | EntityOptionSource<T>

// --- Discriminants -----------------------------------------------------------

export function isStaticSource<T>(s: OptionSource<T>): s is Option<T>[] {
  return Array.isArray(s)
}

export function isFetchSource<T>(s: OptionSource<T>): s is FetchOptionsFn<T> {
  return typeof s === 'function'
}

export function isQuerySource<T>(s: OptionSource<T>): s is QueryOptionSource<T> {
  return typeof s === 'object' && s !== null && !Array.isArray(s) && 'queryFn' in s
}

export function isEntitySource<T>(s: OptionSource<T>): s is EntityOptionSource<T> {
  return typeof s === 'object' && s !== null && !Array.isArray(s) && 'entity' in s
}

/**
 * Une source statique se filtre localement, une source distante se filtre côté serveur.
 * Auto-détecté pour que l'appelant n'ait pas à y penser (KISS).
 */
export function usesServerSearch<T>(source: OptionSource<T>): boolean {
  return !isStaticSource(source)
}

/** Filtrage local, insensible aux accents et à la casse. */
export function filterOptionsLocally<T>(options: Option<T>[], search: string): Option<T>[] {
  if (!search.trim()) return options
  const needle = normalize(search)
  return options.filter(
    (o) => normalize(o.label).includes(needle) || normalize(o.description ?? '').includes(needle),
  )
}

function normalize(input: string): string {
  return input.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}
