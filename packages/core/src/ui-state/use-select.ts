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

export interface UseSelectParams<T = string> {
  source: OptionSource<T>
  value?: T | T[]
  defaultValue?: T | T[]
  onChange?: (value: T | T[], option: Option<T> | Option<T>[]) => void
  multiple?: boolean
  clearable?: boolean
  disabled?: boolean
  searchable?: boolean
  creatable?: boolean
  onCreate?: (label: string) => Promise<Option<T>>
  deps?: Record<string, unknown>
  entityResolver?: UseAsyncOptionsEntityResolver<T>
}

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
      if (multiple) onChange?.(values, options)
      else onChange?.(values[0] as T, options[0] as Option<T>)
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
  }

  const actions = {
    open,
    close,
    toggle,
    select,
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
