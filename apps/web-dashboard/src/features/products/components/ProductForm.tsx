import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  MAX_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
  PRODUCT_STATUS,
  CreateProductSchema,
  type AppError,
  type CreateProductInput,
  type Product,
  type ProductStatus,
} from '@shopnest/contracts'
import { slugify } from '@shopnest/utils'
import { useTranslation } from '@shopnest/i18n/react'
import {
  Alert,
  Button,
  Card,
  Dropdown,
  ImageUploader,
  TextInput,
  Textarea,
} from '@shopnest/ui-web'
import { api, entityResolver } from '@/lib/api'

export interface ProductFormProps {
  /** Absent en création. */
  product?: Product
  currency: string
  submitting: boolean
  error?: AppError
  onSubmit: (values: CreateProductInput) => void
  onCancel: () => void
}

/**
 * doc/04 §5 — UN SEUL schéma Zod, celui de @shopnest/contracts, partagé avec le
 * backend. Le formulaire ne redéfinit aucune règle : longueur, format de slug,
 * bornes de stock viennent du contrat.
 */
export function ProductForm({
  product,
  currency,
  submitting,
  error,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const { t } = useTranslation()

  const form = useForm<CreateProductInput>({
    resolver: zodResolver(CreateProductSchema),
    mode: 'onTouched',
    defaultValues: product
      ? {
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          status: product.status,
          stock: product.stock,
          lowStockThreshold: product.lowStockThreshold,
          imageUrls: product.imageUrls,
          categoryIds: product.categoryIds,
        }
      : {
          name: '',
          slug: '',
          description: '',
          price: { amountCents: 0, currency },
          status: 'draft',
          stock: 0,
          lowStockThreshold: 5,
          imageUrls: [],
          categoryIds: [],
        },
  })

  const { register, handleSubmit, setValue, watch, formState, setError, reset } = form
  const values = watch()

  /*
   * Recalage du formulaire quand le produit change côté serveur.
   *
   * `defaultValues` n'est lu qu'au montage : après l'ajout d'une variante, le
   * stock dérivé passe par exemple de 24 à 10, mais le champ afficherait
   * encore 24 — et l'enregistrement RENVERRAIT 24, écrasant le stock calculé.
   * On se recale sur `updatedAt`, qui change à chaque écriture serveur.
   */
  useEffect(() => {
    if (!product) return
    reset({
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      status: product.status,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      imageUrls: product.imageUrls,
      categoryIds: product.categoryIds,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.updatedAt])

  // Erreurs par champ renvoyées par l'API (slug déjà pris) : replacées sous le
  // champ concerné plutôt qu'en bandeau générique.
  useEffect(() => {
    if (!error?.fields) return
    for (const [field, messageKey] of Object.entries(error.fields)) {
      setError(field as keyof CreateProductInput, { message: t(messageKey) })
    }
  }, [error, setError, t])

  /**
   * Le slug se déduit du nom TANT QU'IL N'A PAS ÉTÉ TOUCHÉ à la main.
   * L'écraser systématiquement casserait l'URL d'un produit déjà publié —
   * et donc ses liens entrants.
   */
  const slugTouched = formState.dirtyFields.slug === true || Boolean(product)

  const handleNameChange = (name: string) => {
    setValue('name', name, { shouldDirty: true, shouldValidate: formState.isSubmitted })
    if (!slugTouched) setValue('slug', slugify(name), { shouldValidate: formState.isSubmitted })
  }

  /*
   * Dès qu'une variante existe, le stock et le prix du produit sont CALCULÉS
   * à partir des variantes (doc contrat : deriveStock / derivePrice). Laisser
   * ces champs modifiables donnerait deux compteurs de stock qui divergent.
   */
  const hasVariants = (product?.variants.length ?? 0) > 0

  const fieldError = (field: keyof CreateProductInput) => {
    const message = formState.errors[field]?.message
    return message ? t(String(message)) : undefined
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-md">
      {/* Erreur globale : quota de plan, panne réseau. */}
      {error && !error.fields && (
        <Alert variant="danger" traceId={error.code === 'INTERNAL' ? error.traceId : undefined}>
          {t(error.userMessageKey)}
        </Alert>
      )}

      <div className="grid gap-md xl:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-md">
          <Card title={t('products.form.general')}>
            <div className="flex flex-col gap-md">
              <TextInput
                label={t('products.columns.name')}
                required
                value={values.name}
                onChange={(event) => handleNameChange(event.target.value)}
                error={fieldError('name')}
              />

              <TextInput
                label={t('products.form.slug')}
                required
                helperText={t('products.form.slugHint')}
                error={fieldError('slug')}
                {...register('slug')}
              />

              <Textarea
                label={t('products.form.description')}
                maxLength={10_000}
                value={values.description}
                error={fieldError('description')}
                {...register('description')}
              />
            </div>
          </Card>

          <Card title={t('products.form.pricing')}>
            <div className="grid gap-md sm:grid-cols-2">
              {/*
                Saisie en unités mineures, comme le contrat : le XAF n'a pas de
                décimale, un champ « en euros » produirait un facteur 100 selon
                la devise du tenant (doc/03 §4).
              */}
              <TextInput
                label={t('products.form.price', { currency })}
                type="number"
                inputMode="numeric"
                min={0}
                required
                value={String(values.price?.amountCents ?? 0)}
                onChange={(event) =>
                  setValue(
                    'price',
                    { amountCents: Number(event.target.value), currency },
                    { shouldDirty: true },
                  )
                }
                error={fieldError('price')}
                helperText={hasVariants ? t('products.form.derivedPrice') : t('products.form.priceHint')}
                disabled={hasVariants}
              />

              <TextInput
                label={t('products.columns.stock')}
                type="number"
                inputMode="numeric"
                min={0}
                required
                disabled={hasVariants}
                helperText={hasVariants ? t('products.form.derivedStock') : undefined}
                error={fieldError('stock')}
                {...register('stock', { valueAsNumber: true })}
              />

              <TextInput
                label={t('products.form.lowStockThreshold')}
                type="number"
                inputMode="numeric"
                min={0}
                helperText={t('products.form.lowStockHint')}
                error={fieldError('lowStockThreshold')}
                {...register('lowStockThreshold', { valueAsNumber: true })}
              />
            </div>
          </Card>

          <Card title={t('products.form.images')}>
            <ImageUploader
              value={values.imageUrls ?? []}
              onChange={(urls) => setValue('imageUrls', urls, { shouldDirty: true })}
              /*
               * `api.uploads.upload` fait les deux appels — ticket puis dépôt —
               * et renvoie l'URL publique. Le composant, lui, ignore HTTP :
               * c'est ce qui permet de le réutiliser tel quel dans le
               * back-office plateforme, qui parle à une autre API.
               */
              upload={(file) => api.uploads.upload(file)}
              max={MAX_PRODUCT_IMAGES}
              formatError={(error) => t(errorKey(error))}
              labels={{
                prompt: t('products.form.imagesPrompt'),
                hint: t('products.form.imagesHint', {
                  max: MAX_PRODUCT_IMAGES,
                  size: Math.round(MAX_IMAGE_BYTES / (1024 * 1024)),
                }),
                cover: t('products.form.imagesCover'),
                remove: t('products.form.imagesRemove'),
                moveLeft: t('products.form.imagesMoveLeft'),
                moveRight: t('products.form.imagesMoveRight'),
                full: t('products.form.imagesFull', { max: MAX_PRODUCT_IMAGES }),
                uploading: t('products.form.imagesUploading'),
              }}
            />
          </Card>
        </div>

        <div className="flex flex-col gap-md">
          <Card title={t('products.form.publication')}>
            <div className="flex flex-col gap-md">
              <Dropdown<ProductStatus>
                label={t('products.columns.status')}
                source={PRODUCT_STATUS.map((status) => ({
                  value: status,
                  label: t(`products.status.${status}`),
                  description: t(`products.form.status.${status}.hint`),
                }))}
                value={values.status}
                onChange={(value) =>
                  value && setValue('status', value, { shouldDirty: true })
                }
              />

              <Dropdown
                label={t('products.filters.category')}
                placeholder={t('products.form.noCategory')}
                multiple
                clearable
                searchable
                source={{ entity: 'categories' }}
                entityResolver={entityResolver}
                value={values.categoryIds}
                onChange={(value) =>
                  setValue('categoryIds', value, { shouldDirty: true })
                }
              />
            </div>
          </Card>
        </div>
      </div>

      {/*
        Une image téléversée n'est pas encore ENREGISTRÉE : elle est entrée
        dans le formulaire, et c'est « Enregistrer » qui la rattache au
        produit. Sans ce rappel, on quitte la page en croyant avoir sauvegardé
        — le fichier est bien sur le stockage, mais aucun produit ne le cite.
      */}
      {(values.imageUrls?.length ?? 0) > 0 && formState.isDirty && (
        <p className="text-right text-xs text-text-secondary">
          {t('products.form.imagesUnsaved')}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-sm">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={submitting}>
          {product ? t('products.form.save') : t('products.form.create')}
        </Button>
      </div>
    </form>
  )
}

/**
 * Clé de message d'une erreur d'envoi.
 *
 * L'API factice comme le vrai client rejettent un `AppError`, mais une panne
 * réseau produit un `TypeError` brut : sans ce repli, la vignette en échec
 * afficherait « undefined » à côté du nom du fichier.
 */
function errorKey(error: unknown): string {
  const key = (error as AppError | undefined)?.userMessageKey
  return typeof key === 'string' ? key : 'errors.generic'
}
