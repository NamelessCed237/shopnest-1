import { useEffect, useState } from 'react'
import type { AppError, CategoryWithCounts } from '@shopnest/contracts'
import { slugify } from '@shopnest/utils'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Dropdown, Modal, TextInput, Textarea } from '@shopnest/ui-web'
import { useCreateCategory, useUpdateCategory } from '../api/use-categories'

export interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absent = création. */
  category?: CategoryWithCounts
  /** Parents éligibles — calculés par l'écran, qui connaît l'arborescence. */
  parentOptions: CategoryWithCounts[]
}

/**
 * Modale plutôt qu'écran dédié : une catégorie tient en quatre champs, et le
 * vendeur en crée souvent plusieurs d'affilée. Le faire naviguer aller-retour
 * à chaque fois serait plus coûteux que la modale ne l'est en complexité.
 */
export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  parentOptions,
}: CategoryFormDialogProps) {
  const { t } = useTranslation()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const mutation = category ? update : create

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState<string | undefined>()
  const [slugTouched, setSlugTouched] = useState(false)

  // Réinitialisation à l'OUVERTURE : le composant reste monté, sans ce recalage
  // la modale rouvrirait avec les valeurs de la catégorie précédente.
  useEffect(() => {
    if (!open) return
    setName(category?.name ?? '')
    setSlug(category?.slug ?? '')
    setDescription(category?.description ?? '')
    setParentId(category?.parentId)
    // En édition, le slug existe déjà : on ne le régénère jamais depuis le nom,
    // cela casserait l'URL de la catégorie et ses liens entrants.
    setSlugTouched(Boolean(category))
    create.reset()
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category])

  const error = mutation.error as AppError | null
  const fieldError = (field: string) =>
    error?.fields?.[field] ? t(error.fields[field]!) : undefined

  const canSubmit = name.trim().length > 0 && slug.trim().length > 0 && !mutation.isPending

  const handleSubmit = () => {
    if (!canSubmit) return
    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      position: category?.position ?? parentOptions.length,
      ...(parentId ? { parentId } : {}),
    }

    if (category) {
      update.mutate(
        { id: category.id, input: payload },
        { onSuccess: () => onOpenChange(false) },
      )
    } else {
      create.mutate(payload, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={category ? t('categories.form.editTitle') : t('categories.form.newTitle')}
      description={category ? undefined : t('categories.form.newSubtitle')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending} disabled={!canSubmit}>
            {category ? t('products.form.save') : t('categories.form.create')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        {/* Erreur globale : les erreurs par champ sont affichées sous le champ. */}
        {error && !error.fields && (
          <Alert variant="danger">{t(error.userMessageKey)}</Alert>
        )}

        <TextInput
          label={t('categories.form.name')}
          required
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (!slugTouched) setSlug(slugify(event.target.value))
          }}
          error={fieldError('name')}
        />

        <TextInput
          label={t('products.form.slug')}
          required
          value={slug}
          onChange={(event) => {
            setSlugTouched(true)
            setSlug(event.target.value)
          }}
          helperText={t('categories.form.slugHint')}
          error={fieldError('slug')}
        />

        <Dropdown
          label={t('categories.form.parent')}
          placeholder={t('categories.form.noParent')}
          clearable
          source={parentOptions.map((option) => ({
            value: option.id,
            label: option.name,
          }))}
          value={parentId}
          onChange={(value) => setParentId(value)}
          error={fieldError('parentId')}
          helperText={t('categories.form.parentHint')}
        />

        <Textarea
          label={t('products.form.description')}
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
    </Modal>
  )
}
