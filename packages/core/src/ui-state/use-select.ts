import { useCallback, useMemo, useRef, useState } from 'react'
import { indexBy } from '@shopnest/utils'
import type { Option, OptionSource } from './option-source.js'
import { useAsyncOptions, type AsyncOptionsStatus } from './use-async-options.js'

/**
 * doc/07 §3.3 — le comportement complet d'un select, sans aucun rendu.
 *
 * Consommé À L'IDENTIQUE par packages/ui-web (Popover Radix) et
 * packages/ui-native (BottomSheet + FlashList). Corriger un bug de clavier,
 * de sélection ou d'accessibilité ici le corrige sur les deux plateformes.
 */

interface SelectCommonParams<T> {
  source: OptionSource<T>
  clearable?: boolean
  disabled?: boolean
  searchable?: boolean
  creatable?: boolean
  onCreate?: (label: string) => Promise<Option<T>>
  deps?: Record<string, unknown>
  entityResolver?: UseAsyncOptionsEntityResolver<T>
}

/**
 * Sélection SIMPLE — `value` est une valeur, `onChange` en reçoit une.
 *
 * `undefined` est un état légitime et non un accident : c'est ce que reçoit
 * l'appelant quand le champ est vidé via `clearable`.
 */
export interface SingleSelectParams<T> extends SelectCommonParams<T> {
  multiple?: false
  value?: T
  defaultValue?: T
  onChange?: (value: T | undefined, option: Option<T> | undefined) => void
}

/** Sélection MULTIPLE — `value` est un tableau, `onChange` en reçoit un. */
export interface MultiSelectParams<T> extends SelectCommonParams<T> {
  multiple: true
  value?: T[]
  defaultValue?: T[]
  onChange?: (value: T[], options: Option<T>[]) => void
}

/**
 * Union DISCRIMINÉE par `multiple`, et c'est tout l'intérêt.
 *
 * L'ancienne signature — `value?: T | T[]`, `onChange?: (v: T | T[]) => void` —
 * obligeait CHAQUE appelant à écrire `value as ProductStatus | undefined` pour
 * récupérer un type utilisable. Passer un champ en sélection multiple devenait
 * alors une modification manuelle propagée de proche en proche, sans que le
 * compilateur signale ce qui restait à corriger.
 *
 * Avec la discrimination, ajouter `multiple` suffit : TypeScript retype `value`
 * et `onChange`, et signale précisément les endroits à adapter. Aucun cast.
 */
export type UseSelectParams<T = string> = SingleSelectParams<T> | MultiSelectParams<T>

type UseAsyncOptionsEntityResolver<T> = NonNullable<
  Parameters<typeof useAsyncOptions<T>>[0]['entityResolver']
>

export interface SelectState<T> {
  isOpen: boolean
  disabled: boolean
  searchable: boolean
  search: string
  options: Option<T>[]
  status: AsyncOptionsStatus
  error: ReturnType<typeof useAsyncOptions<T>>['error']
  selected: Option<T>[]
  highlightedIndex: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  canCreate: boolean
  isSelected: (option: Option<T>) => boolean
  multiple: boolean
  /** Toutes les options chargées sont cochées — état de la bascule « tout ». */
  allSelected: boolean
}

export function useSelect<T = string>(params: UseSelectParams<T>) {
  const {
    source,
    multiple = false,
    clearable = false,
    disabled = false,
    creatable = false,
    onCreate,
    onChange,
    deps,
    entityResolver,
  } = params

  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [internalValue, setInternalValue] = useState<T[]>(() => toArray(params.defaultValue))
  const listboxId = useRef(`listbox-${Math.random().toString(36).slice(2, 9)}`).current

  const isControlled = params.value !== undefined
  const selectedValues = isControlled ? toArray(params.value) : internalValue

  const async = useAsyncOptions<T>({
    source,
    enabled: isOpen,
    deps: deps ?? {},
    ...(entityResolver ? { entityResolver } : {}),
  })

  const searchable = params.searchable ?? async.options.length > 8

  // Index O(1) — un `find` par option rendue serait O(n²) sur une liste longue.
  const optionByValue = useMemo(() => indexBy(async.options, (o) => String(o.value)), [async.options])
  const selectedSet = useMemo(() => new Set(selectedValues.map(String)), [selectedValues])

  const selected = useMemo(
    () =>
      selectedValues.map(
        (v): Option<T> =>
          optionByValue.get(String(v)) ?? { value: v, label: async.resolveLabel(v) ?? String(v) },
      ),
    [selectedValues, optionByValue, async],
  )

  const isSelected = useCallback((o: Option<T>) => selectedSet.has(String(o.value)), [selectedSet])

  const commit = useCallback(
    (values: T[], options: Option<T>[]) => {
      if (!isControlled) setInternalValue(values)

      /*
       * L'UNIQUE endroit où la forme de `onChange` est aplatie.
       *
       * L'union discriminée garantit aux appelants un `onChange` correctement
       * typé ; à l'intérieur, le hook travaille toujours sur des tableaux —
       * c'est ce qui lui permet de traiter les deux modes avec un seul chemin
       * de code. Le cast est confiné ici, sous la garde de `multiple` qui vient
       * des mêmes props que `onChange`.
       */
      if (multiple) {
        ;(onChange as MultiSelectParams<T>['onChange'])?.(values, options)
      } else {
        ;(onChange as SingleSelectParams<T>['onChange'])?.(values[0], options[0])
      }
    },
    [isControlled, multiple, onChange],
  )

  const select = useCallback(
    (option: Option<T>) => {
      if (option.disabled) return
      if (multiple) {
        const exists = selectedSet.has(String(option.value))
        const values = exists
          ? selectedValues.filter((v) => String(v) !== String(option.value))
          : [...selectedValues, option.value]
        commit(
          values,
          values.map((v) => optionByValue.get(String(v)) ?? { value: v, label: String(v) }),
        )
      } else {
        commit([option.value], [option])
        setIsOpen(false)
      }
    },
    [multiple, selectedSet, selectedValues, commit, optionByValue],
  )

  const clear = useCallback(() => commit([], []), [commit])

  /**
   * Retire UNE valeur, sans ouvrir la liste.
   *
   * Nécessaire pour les pastilles du déclencheur : en sélection multiple, la
   * seule façon de désélectionner était de rouvrir le menu et de retrouver la
   * ligne — pénible dès qu'on a coché cinq éléments dans une liste de cent.
   */
  const remove = useCallback(
    (value: T) => {
      const values = selectedValues.filter((v) => String(v) !== String(value))
      commit(
        values,
        values.map((v) => optionByValue.get(String(v)) ?? { value: v, label: String(v) }),
      )
    },
    [selectedValues, commit, optionByValue],
  )

  /**
   * Coche ou décoche toutes les options CHARGÉES.
   *
   * « Chargées » et non « existantes » : sur une source paginée, le hook ne
   * connaît que la page courante. Prétendre tout sélectionner alors qu'il reste
   * des pages serait un mensonge — et une requête de plus à chaque défilement.
   * Le composant n'affiche donc la bascule que sur une source complète.
   */
  const toggleAll = useCallback(() => {
    const selectable = async.options.filter((option) => !option.disabled)
    const allSelected = selectable.length > 0 && selectable.every((o) => selectedSet.has(String(o.value)))
    if (allSelected) commit([], [])
    else commit(selectable.map((o) => o.value), selectable)
  }, [async.options, selectedSet, commit])

  const create = useCallback(async () => {
    if (!creatable || !onCreate || !async.search.trim()) return
    const option = await onCreate(async.search.trim())
    select(option)
    async.setSearch('')
  }, [creatable, onCreate, async, select])

  const open = useCallback(() => {
    if (disabled) return
    setIsOpen(true)
    setHighlightedIndex(0)
  }, [disabled])

  const close = useCallback(() => {
    setIsOpen(false)
    setHighlightedIndex(-1)
  }, [])

  const toggle = useCallback(
    (next?: boolean) => ((next ?? !isOpen) ? open() : close()),
    [isOpen, open, close],
  )

  const move = useCallback(
    (delta: number) => {
      const count = async.options.length
      if (count === 0) return
      setHighlightedIndex((i) => (i + delta + count) % count)
    },
    [async.options.length],
  )

  const handleKeyDown = useCallback(
    (key: string): boolean => {
      switch (key) {
        case 'ArrowDown':
          isOpen ? move(1) : open()
          return true
        case 'ArrowUp':
          isOpen ? move(-1) : open()
          return true
        case 'Home':
          setHighlightedIndex(0)
          return true
        case 'End':
          setHighlightedIndex(async.options.length - 1)
          return true
        case 'Enter':
        case ' ': {
          if (!isOpen) {
            open()
            return true
          }
          const option = async.options[highlightedIndex]
          if (option) select(option)
          else if (creatable) void create()
          return true
        }
        case 'Escape':
          close()
          return true
        case 'Backspace':
          if (multiple && !async.search && selectedValues.length > 0) {
            const values = selectedValues.slice(0, -1)
            commit(values, [])
            return true
          }
          return false
        default:
          return false
      }
    },
    [
      isOpen, move, open, close, select, create, creatable, highlightedIndex,
      async.options, async.search, multiple, selectedValues, commit,
    ],
  )

  const canCreate =
    creatable &&
    async.search.trim().length > 0 &&
    !async.options.some((o) => o.label.toLowerCase() === async.search.trim().toLowerCase())

  const state: SelectState<T> = {
    isOpen,
    disabled,
    searchable,
    search: async.search,
    options: async.options,
    status: async.status,
    error: async.error,
    selected,
    highlightedIndex,
    hasNextPage: async.hasNextPage,
    isFetchingNextPage: async.isFetchingNextPage,
    canCreate,
    isSelected,
    multiple,
    allSelected:
      async.options.length > 0 &&
      async.options.every((o) => o.disabled || selectedSet.has(String(o.value))),
  }

  const actions = {
    open,
    close,
    toggle,
    select,
    remove,
    toggleAll,
    clear: clearable ? clear : undefined,
    create,
    setSearch: async.setSearch,
    setHighlightedIndex,
    fetchNextPage: async.fetchNextPage,
    retry: async.retry,
  }

  /**
   * doc/07 R7 — l'accessibilité est fournie par le hook, pas laissée à l'implémenteur.
   * Le composant se contente de répandre ces props.
   */
  const a11y = {
    trigger: {
      role: 'combobox' as const,
      'aria-expanded': isOpen,
      'aria-controls': listboxId,
      'aria-haspopup': 'listbox' as const,
      'aria-disabled': disabled,
      'aria-activedescendant':
        isOpen && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined,
    },
    listbox: {
      id: listboxId,
      role: 'listbox' as const,
      'aria-multiselectable': multiple,
    },
    option: (index: number) => {
      const option = async.options[index]
      return {
        id: `${listboxId}-option-${index}`,
        role: 'option' as const,
        'aria-selected': option ? isSelected(option) : false,
        'aria-disabled': option?.disabled ?? false,
      }
    },
  }

  return { state, actions, a11y, keyboard: { handleKeyDown } }
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}
