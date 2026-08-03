import type { KeyboardEvent, ReactNode } from 'react'
import type { AppError } from '@shopnest/contracts'
import { useDataTable, type DataTableSort } from '@shopnest/core'
import { ErrorState } from '../feedback/ErrorState.js'
import { EmptyState } from '../feedback/EmptyState.js'
import { cn } from '../lib/cn.js'

/**
 * doc/07 §4 — le contrat de composants appliqué au tableau.
 *
 * Le composant reçoit un ÉTAT ASYNCHRONE, pas un tableau de lignes : c'est lui
 * qui rend les quatre états (chargement, erreur + reprise, vide, succès), pas
 * l'appelant. Un écran qui oublie l'un des quatre est incomplet — ici c'est
 * structurellement impossible.
 */

export type AsyncStatus = 'loading' | 'error' | 'empty' | 'success'

export interface DataTableColumn<Row, K extends string = string> {
  key: K
  header: string
  sortable?: boolean
  align?: 'start' | 'end'
  /** Largeur en classe utilitaire (ex. 'w-32'). Par défaut : automatique. */
  width?: string
  render: (row: Row) => ReactNode
}

export interface DataTableProps<Row, K extends string = string> {
  /** État asynchrone fourni par le hook de données de la feature (doc/04 §4). */
  status: AsyncStatus
  rows: readonly Row[]
  error?: AppError
  onRetry?: () => void

  columns: DataTableColumn<Row, K>[]
  rowId: (row: Row) => string
  caption: string

  sort?: DataTableSort<K>
  onSortChange?: (sort: DataTableSort<K>) => void

  selectionMode?: 'none' | 'single' | 'multiple'
  onSelectionChange?: (ids: string[]) => void
  onRowClick?: (row: Row) => void

  /** R6 — rendu substituable pour les états sans données. */
  renderEmpty?: () => ReactNode
  skeletonRows?: number
}

export function DataTable<Row, K extends string = string>({
  status,
  rows,
  error,
  onRetry,
  columns,
  rowId,
  caption,
  sort,
  onSortChange,
  selectionMode = 'none',
  onSelectionChange,
  onRowClick,
  renderEmpty,
  skeletonRows = 8,
}: DataTableProps<Row, K>) {
  const table = useDataTable<Row, K>({
    rows,
    rowId,
    sort,
    onSortChange,
    selectionMode,
    onSelectionChange,
  })

  if (status === 'error') {
    return (
      <Frame>
        <ErrorState error={error} onRetry={onRetry} />
      </Frame>
    )
  }

  if (status === 'empty') {
    return <Frame>{renderEmpty?.() ?? <EmptyState />}</Frame>
  }

  const isLoading = status === 'loading'
  const selectable = selectionMode !== 'none'

  return (
    // doc/artifact : le tableau défile dans son propre conteneur ; la page
    // ne défile jamais horizontalement.
    <div className="overflow-x-auto rounded-md border border-border-base bg-surface-base">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>

        <thead>
          <tr className="border-b border-border-base bg-surface-raised">
            {selectable && (
              <th scope="col" className="w-12 px-sm py-sm">
                {selectionMode === 'multiple' && (
                  <input
                    type="checkbox"
                    checked={table.state.allSelected}
                    onChange={table.actions.toggleAll}
                    aria-label="Tout sélectionner"
                  />
                )}
              </th>
            )}

            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={column.sortable ? table.a11y.ariaSortFor(column.key) : undefined}
                className={cn(
                  'px-md py-sm font-medium text-text-secondary',
                  column.align === 'end' ? 'text-end' : 'text-start',
                  column.width,
                )}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => table.actions.toggleSort(column.key)}
                    className="inline-flex items-center gap-xs hover:text-text-primary"
                  >
                    {column.header}
                    <SortIndicator active={sort?.key === column.key} order={sort?.order} />
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody aria-busy={isLoading}>
          {isLoading
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={i} className="border-b border-border-base last:border-0">
                  {selectable && <td className="px-sm py-sm" />}
                  {columns.map((column) => (
                    <td key={column.key} className="px-md py-sm">
                      <div className="h-4 animate-pulse rounded-sm bg-surface-sunken" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  /*
                   * doc/04 §8 — une ligne cliquable doit être atteignable au
                   * clavier. Sans `tabIndex` et sans gestion d'Entrée/Espace,
                   * la seule façon d'ouvrir le détail serait la souris.
                   */
                  {...(onRowClick
                    ? {
                        tabIndex: 0,
                        role: 'button' as const,
                        onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          onRowClick(row)
                        },
                      }
                    : {})}
                  className={cn('border-b border-border-base last:border-0', {
                    'cursor-pointer hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus':
                      Boolean(onRowClick),
                    'bg-brand-primarySubtle': table.state.isSelected(row),
                  })}
                >
                  {selectable && (
                    <td className="px-sm py-sm" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={table.state.isSelected(row)}
                        onChange={() => table.actions.toggleRow(row)}
                        aria-label="Sélectionner la ligne"
                      />
                    </td>
                  )}

                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-md py-sm text-text-primary',
                        column.align === 'end' ? 'text-end' : 'text-start',
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>

      {isLoading && <span className="sr-only">Chargement des données…</span>}
    </div>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-border-base bg-surface-base">{children}</div>
  )
}

function SortIndicator({ active, order }: { active: boolean; order?: 'asc' | 'desc' }) {
  if (!active) return <span aria-hidden="true" className="opacity-30">↕</span>
  return <span aria-hidden="true">{order === 'asc' ? '↑' : '↓'}</span>
}
