import { useEffect, useState } from 'react'
import type { CategoryWithCounts } from '@shopnest/contracts'
import { useDebouncedValue } from '@shopnest/core'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Modal, TextInput } from '@shopnest/ui-web'
import {
  CategoriesTable,
  CategoryFormDialog,
  useCategories,
  useDeleteCategory,
} from '@/features/categories'

export function CategoriesPage() {
  const { t } = useTranslation()

  const [searchDraft, setSearchDraft] = useState('')
  const search = useDebouncedValue(searchDraft, 300)

  const query = useCategories(search || undefined)
  const remove = useDeleteCategory()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryWithCounts | undefined>()
  const [pendingDelete, setPendingDelete] = useState<CategoryWithCounts | undefined>()

  // L'erreur de suppression appartient à la modale : la laisser après fermeture
  // afficherait un message orphelin sur l'écran de liste.
  useEffect(() => {
    if (!pendingDelete) remove.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDelete])

  const categories = query.data ?? []

  /**
   * Parents éligibles : uniquement les catégories RACINES, et jamais
   * elle-même. Le serveur applique la même règle — ce filtre évite juste de
   * proposer un choix qui serait refusé.
   */
  const parentOptions = categories.filter(
    (category) => !category.parentId && category.id !== editing?.id,
  )

  const status = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : categories.length === 0
        ? 'empty'
        : 'success'

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const openEdit = (category: CategoryWithCounts) => {
    setEditing(category)
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t('categories.title')}</h1>
          <p className="text-sm text-text-secondary">{t('categories.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>{t('categories.actions.create')}</Button>
      </header>

      <div className="max-w-sm">
        <TextInput
          label={t('categories.filters.search')}
          type="search"
          placeholder={t('categories.filters.searchPlaceholder')}
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
      </div>

      <CategoriesTable
        categories={categories}
        status={status}
        error={query.error ?? undefined}
        onRetry={() => void query.refetch()}
        onEdit={openEdit}
        onDelete={setPendingDelete}
        onCreate={openCreate}
        filtered={Boolean(search)}
      />

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
        parentOptions={parentOptions}
      />

      <Modal
        open={pendingDelete !== undefined}
        onOpenChange={(open) => !open && setPendingDelete(undefined)}
        title={t('categories.delete.title')}
        description={t('categories.delete.body', { name: pendingDelete?.name ?? '' })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(undefined)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => {
                if (!pendingDelete) return
                remove.mutate(pendingDelete.id, {
                  onSuccess: () => setPendingDelete(undefined),
                })
              }}
            >
              {t('categories.actions.delete')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-sm">
          {/*
            Le refus est affiché DANS la modale, à l'endroit où l'utilisateur
            vient de cliquer : « 5 produits rattachés » lui dit quoi faire
            avant de réessayer.
          */}
          {remove.error && <Alert variant="danger">{t(remove.error.userMessageKey)}</Alert>}

          {pendingDelete && pendingDelete.productCount > 0 && !remove.error && (
            <Alert variant="warning">
              {t('categories.delete.inUseWarning', { count: pendingDelete.productCount })}
            </Alert>
          )}

          <p className="text-sm text-text-secondary">{t('categories.delete.explanation')}</p>
        </div>
      </Modal>
    </div>
  )
}
