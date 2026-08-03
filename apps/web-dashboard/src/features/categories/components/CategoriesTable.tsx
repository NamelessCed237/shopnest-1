import { useMemo } from 'react'
import type { CategoryWithCounts } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Badge, Button, DataTable, EmptyState, type DataTableColumn } from '@shopnest/ui-web'

export interface CategoriesTableProps {
  categories: CategoryWithCounts[]
  status: 'loading' | 'error' | 'empty' | 'success'
  error?: Parameters<typeof DataTable>[0]['error']
  onRetry: () => void
  onEdit: (category: CategoryWithCounts) => void
  onDelete: (category: CategoryWithCounts) => void
  onCreate: () => void
  filtered: boolean
}

export function CategoriesTable({
  categories,
  status,
  error,
  onRetry,
  onEdit,
  onDelete,
  onCreate,
  filtered,
}: CategoriesTableProps) {
  const { t, number } = useTranslation()

  const columns = useMemo<DataTableColumn<CategoryWithCounts>[]>(
    () => [
      {
        key: 'name',
        header: t('categories.columns.name'),
        render: (category) => (
          <div className="flex items-center gap-sm">
            {/*
              Indentation des sous-catégories : la liste est APLATIE mais
              ordonnée parent → enfants, l'indentation restitue la hiérarchie
              sans imbriquer les lignes du tableau.
            */}
            {category.parentId && (
              <span aria-hidden="true" className="ps-md text-text-disabled">
                └
              </span>
            )}
            <div className="flex flex-col">
              <span className="font-medium text-text-primary">{category.name}</span>
              <span className="text-xs text-text-secondary">{category.slug}</span>
            </div>
          </div>
        ),
      },
      {
        key: 'level',
        header: t('categories.columns.level'),
        width: 'w-36',
        render: (category) => (
          <Badge variant={category.parentId ? 'neutral' : 'info'}>
            {t(category.parentId ? 'categories.level.child' : 'categories.level.root')}
          </Badge>
        ),
      },
      {
        key: 'productCount',
        header: t('categories.columns.products'),
        align: 'end',
        render: (category) => <span className="tabular-nums">{number(category.productCount)}</span>,
      },
      {
        key: 'childCount',
        header: t('categories.columns.children'),
        align: 'end',
        render: (category) =>
          category.childCount > 0 ? (
            <span className="tabular-nums">{number(category.childCount)}</span>
          ) : (
            <span className="text-text-disabled">—</span>
          ),
      },
      {
        key: 'actions',
        header: t('categories.columns.actions'),
        align: 'end',
        width: 'w-56',
        render: (category) => (
          <div className="flex justify-end gap-xs">
            <Button variant="secondary" size="sm" onClick={() => onEdit(category)}>
              {t('categories.actions.edit')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(category)}
              // Le bouton reste ACTIF même si la suppression sera refusée :
              // le message d'erreur explique pourquoi, ce qu'un bouton grisé
              // sans explication ne fait pas.
            >
              {t('categories.actions.delete')}
            </Button>
          </div>
        ),
      },
    ],
    [t, number, onEdit, onDelete],
  )

  return (
    <DataTable<CategoryWithCounts>
      caption={t('categories.tableCaption')}
      status={status}
      rows={categories}
      error={error}
      onRetry={onRetry}
      columns={columns}
      rowId={(category) => category.id}
      skeletonRows={6}
      renderEmpty={() =>
        filtered ? (
          <EmptyState title={t('categories.empty.filtered')} />
        ) : (
          <EmptyState
            title={t('categories.empty.title')}
            action={<Button onClick={onCreate}>{t('categories.actions.create')}</Button>}
          />
        )
      }
    />
  )
}
