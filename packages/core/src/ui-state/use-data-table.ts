import { useCallback, useMemo, useState } from 'react'
import { indexBy } from '@shopnest/utils'

/**
 * doc/07 §4 — comportement d'un tableau de données, sans aucun rendu.
 *
 * Partagé web / mobile : le web rend un <table>, le mobile une liste de cartes.
 * Le tri, la sélection et la dérivation des lignes sont identiques des deux côtés.
 */

export type SortOrder = 'asc' | 'desc'

export interface DataTableSort<K extends string = string> {
  key: K
  order: SortOrder
}

export interface UseDataTableParams<Row, K extends string = string> {
  rows: readonly Row[]
  rowId: (row: Row) => string
  sort?: DataTableSort<K>
  onSortChange?: (sort: DataTableSort<K>) => void
  selectionMode?: 'none' | 'single' | 'multiple'
  /**
   * Sélection CONTRÔLÉE — R4, comme pour le select.
   *
   * Sans elle, l'appelant peut apprendre ce qui est coché mais pas le
   * décocher : une barre d'actions groupées ne pourrait pas vider la sélection
   * après avoir agi, et parlerait encore de lignes que le tableau vient de
   * modifier ou de retirer.
   */
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
}

export function useDataTable<Row, K extends string = string>({
  rows,
  rowId,
  sort,
  onSortChange,
  selectionMode = 'none',
  selectedIds: controlledIds,
  onSelectionChange,
}: UseDataTableParams<Row, K>) {
  const [internalIds, setInternalIds] = useState<string[]>([])
  const isControlled = controlledIds !== undefined
  const selectedIds = isControlled ? controlledIds : internalIds

  // Set plutôt qu'un `includes` par ligne : O(1) au lieu de O(n) × n lignes.
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const rowById = useMemo(() => indexBy(rows, rowId), [rows, rowId])

  const commit = useCallback(
    (ids: string[]) => {
      // En mode contrôlé, l'état interne n'est pas écrit : le parent est la
      // seule source de vérité, sinon les deux divergeraient au premier vidage.
      if (!isControlled) setInternalIds(ids)
      onSelectionChange?.(ids)
    },
    [isControlled, onSelectionChange],
  )

  const toggleRow = useCallback(
    (row: Row) => {
      if (selectionMode === 'none') return
      const id = rowId(row)
      if (selectionMode === 'single') {
        commit(selectedSet.has(id) ? [] : [id])
        return
      }
      commit(selectedSet.has(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id])
    },
    [selectionMode, rowId, selectedSet, selectedIds, commit],
  )

  const allIds = useMemo(() => rows.map(rowId), [rows, rowId])
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedSet.has(id))

  const toggleAll = useCallback(() => {
    if (selectionMode !== 'multiple') return
    commit(allSelected ? [] : allIds)
  }, [selectionMode, allSelected, allIds, commit])

  /** Un clic sur une colonne déjà triée inverse le sens — convention universelle. */
  const toggleSort = useCallback(
    (key: K) => {
      if (!onSortChange) return
      const order: SortOrder = sort?.key === key && sort.order === 'desc' ? 'asc' : 'desc'
      onSortChange({ key, order })
    },
    [sort, onSortChange],
  )

  /** Valeur `aria-sort` attendue par les lecteurs d'écran sur un <th>. */
  const ariaSortFor = useCallback(
    (key: K): 'ascending' | 'descending' | 'none' => {
      if (sort?.key !== key) return 'none'
      return sort.order === 'asc' ? 'ascending' : 'descending'
    },
    [sort],
  )

  return {
    state: {
      selectedIds,
      selectedRows: selectedIds.map((id) => rowById.get(id)).filter((r): r is Row => Boolean(r)),
      allSelected,
      selectionMode,
      sort,
      isSelected: (row: Row) => selectedSet.has(rowId(row)),
    },
    actions: {
      toggleRow,
      toggleAll,
      toggleSort,
      clearSelection: () => commit([]),
    },
    a11y: { ariaSortFor },
  }
}
