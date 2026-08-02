import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppError } from '@shopnest/contracts'
import {
  filterOptionsLocally,
  isEntitySource,
  isFetchSource,
  isQuerySource,
  isStaticSource,
  usesServerSearch,
  type FetchOptionsFn,
  type Option,
  type OptionSource,
} from './option-source.js'

/**
 * doc/07 §3.2 — le cœur du système de composants dynamiques.
 *
 * Résout n'importe quelle OptionSource et absorbe, UNE SEULE FOIS pour tout le projet :
 * debounce, annulation des requêtes obsolètes, chargement paresseux, pagination par
 * curseur, dépendances entre champs, résolution du libellé d'une valeur hors page,
 * filtrage local vs serveur, et les quatre états d'affichage.
 *
 * Aucun composant ne réimplémente cette logique — ni sur web, ni sur mobile.
 */

export type AsyncOptionsStatus = 'idle' | 'loading' | 'error' | 'empty' | 'success'

export interface UseAsyncOptionsParams<T = string> {
  source: OptionSource<T>
  /** Recherche serveur si true, filtrage local sinon. Auto-détecté par défaut. */
  serverSearch?: boolean
  debounceMs?: number
  /** Ne charge qu'à la première ouverture — évite N requêtes au montage d'un formulaire. */
  lazy?: boolean
  /** Ouvre/ferme le champ : déclenche le chargement paresseux. */
  enabled?: boolean
  deps?: Record<string, unknown>
  /** Options connues d'avance (valeur déjà sélectionnée dont le libellé doit s'afficher). */
  initialOptions?: Option<T>[]
  /** Résolution d'une source `entity` — injectée par l'app (doc/06 §3). */
  entityResolver?: (entity: string, params?: Record<string, unknown>) => FetchOptionsFn<T>
}

export interface UseAsyncOptionsResult<T = string> {
  options: Option<T>[]
  status: AsyncOptionsStatus
  error?: AppError
  search: string
  setSearch: (value: string) => void
  hasNextPage: boolean
  fetchNextPage: () => void
  isFetchingNextPage: boolean
  retry: () => void
  /** Libellé d'une valeur sélectionnée absente de la page courante. */
  resolveLabel: (value: T) => string | undefined
}

const DEFAULT_DEBOUNCE_MS = 300

export function useAsyncOptions<T = string>(
  params: UseAsyncOptionsParams<T>,
): UseAsyncOptionsResult<T> {
  const {
    source,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    lazy = true,
    enabled = true,
    deps = {},
    initialOptions = [],
    entityResolver,
  } = params

  const serverSearch = params.serverSearch ?? usesServerSearch(source)

  const [search, setSearchRaw] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [options, setOptions] = useState<Option<T>[]>(() =>
    isStaticSource(source) ? source : initialOptions,
  )
  const [status, setStatus] = useState<AsyncOptionsStatus>(() =>
    isStaticSource(source) ? 'success' : 'idle',
  )
  const [error, setError] = useState<AppError | undefined>()
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false)

  const abortRef = useRef<AbortController | undefined>(undefined)
  const hasLoadedRef = useRef(false)
  /** Cache libellé par valeur — évite de perdre l'affichage en changeant de page. */
  const labelCacheRef = useRef(new Map<T, string>())

  const depsKey = JSON.stringify(deps)

  const fetcher = useMemo<FetchOptionsFn<T> | undefined>(() => {
    if (isStaticSource(source)) return undefined
    if (isFetchSource(source)) return source
    if (isQuerySource(source)) return source.queryFn
    if (isEntitySource(source)) {
      if (!entityResolver) {
        throw new Error(
          "Source `entity` utilisée sans entityResolver. L'app doit le fournir via UiConfigProvider (doc/06 §3).",
        )
      }
      return entityResolver(source.entity, source.params)
    }
    return undefined
  }, [source, entityResolver])

  // Debounce de la recherche — sans cela, « ordinateur » déclenche 11 requêtes (doc/02 §2.3).
  useEffect(() => {
    if (!serverSearch) {
      setDebouncedSearch(search)
      return
    }
    const timer = setTimeout(() => setDebouncedSearch(search), debounceMs)
    return () => clearTimeout(timer)
  }, [search, debounceMs, serverSearch])

  const load = useCallback(
    async (cursor?: string) => {
      if (!fetcher) return

      // Annule la requête précédente : sinon une réponse lente écrase une réponse récente.
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (cursor) setIsFetchingNextPage(true)
      else setStatus('loading')
      setError(undefined)

      try {
        const result = await fetcher({
          search: debouncedSearch,
          cursor,
          deps,
          signal: controller.signal,
        })

        for (const option of result.options) labelCacheRef.current.set(option.value, option.label)

        const merged = cursor ? [...options, ...result.options] : result.options
        setOptions(merged)
        setNextCursor(result.nextCursor)
        setStatus(merged.length === 0 ? 'empty' : 'success')
        hasLoadedRef.current = true
      } catch (err) {
        if (controller.signal.aborted) return
        setError(toAppError(err))
        setStatus('error')
      } finally {
        setIsFetchingNextPage(false)
      }
    },
    // `options` est volontairement hors deps : il n'est lu que pour la concaténation
    // de page suivante, et l'inclure relancerait le chargement en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetcher, debouncedSearch, depsKey],
  )

  // Chargement initial et rechargement sur recherche / dépendances.
  useEffect(() => {
    if (isStaticSource(source)) return
    if (!enabled) return
    if (lazy && !enabled) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debouncedSearch, depsKey])

  // Une dépendance qui change invalide la liste (pays → ville).
  useEffect(() => {
    if (isStaticSource(source)) return
    setOptions([])
    setNextCursor(undefined)
    setStatus('idle')
    hasLoadedRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey])

  const visibleOptions = useMemo(
    () => (serverSearch ? options : filterOptionsLocally(options, search)),
    [options, search, serverSearch],
  )

  const effectiveStatus: AsyncOptionsStatus =
    status === 'success' && visibleOptions.length === 0 ? 'empty' : status

  const fetchNextPage = useCallback(() => {
    if (!nextCursor || isFetchingNextPage) return
    void load(nextCursor)
  }, [nextCursor, isFetchingNextPage, load])

  const resolveLabel = useCallback((value: T) => labelCacheRef.current.get(value), [])

  return {
    options: visibleOptions,
    status: effectiveStatus,
    error,
    search,
    setSearch: setSearchRaw,
    hasNextPage: Boolean(nextCursor),
    fetchNextPage,
    isFetchingNextPage,
    retry: () => void load(),
    resolveLabel,
  }
}

function toAppError(err: unknown): AppError {
  if (typeof err === 'object' && err !== null && 'code' in err && 'traceId' in err) {
    return err as AppError
  }
  return {
    code: 'INTERNAL',
    message: err instanceof Error ? err.message : String(err),
    userMessageKey: 'errors.generic',
    traceId: 'unknown',
  }
}
