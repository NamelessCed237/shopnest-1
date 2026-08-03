import { useEffect, useState } from 'react'
import type { AppError, ProductVariant } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Modal, TextInput } from '@shopnest/ui-web'
import { useAddVariant, useUpdateVariant } from '../api/use-variant-mutations'

export interface VariantFormDialogProps {
  productId: string
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absent = création. */
  variant?: ProductVariant
}

interface AttributeRow {
  key: string
  value: string
}

export function VariantFormDialog({
  productId,
  currency,
  open,
  onOpenChange,
  variant,
}: VariantFormDialogProps) {
  const { t } = useTranslation()
  const add = useAddVariant(productId)
  const update = useUpdateVariant(productId)
  const mutation = variant ? update : add

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('0')
  const [stock, setStock] = useState('0')
  const [attributes, setAttributes] = useState<AttributeRow[]>([])

  useEffect(() => {
    if (!open) return
    setName(variant?.name ?? '')
    setSku(variant?.sku ?? '')
    setPrice(String(variant?.price.amountCents ?? 0))
    setStock(String(variant?.stock ?? 0))
    setAttributes(
      Object.entries(variant?.attributes ?? {}).map(([key, value]) => ({ key, value })),
    )
    add.reset()
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, variant])

  const error = mutation.error as AppError | null
  const fieldError = (field: string) =>
    error?.fields?.[field] ? t(error.fields[field]!) : undefined

  const priceCents = Number(price)
  const stockValue = Number(stock)
  const canSubmit =
    name.trim().length > 0 &&
    sku.trim().length > 0 &&
    Number.isInteger(priceCents) &&
    priceCents >= 0 &&
    Number.isInteger(stockValue) &&
    stockValue >= 0 &&
    !mutation.isPending

  const handleSubmit = () => {
    if (!canSubmit) return

    const payload = {
      name: name.trim(),
      sku: sku.trim(),
      price: { amountCents: priceCents, currency },
      stock: stockValue,
      // Les lignes vides sont ignorées plutôt que rejetées : l'utilisateur a
      // simplement ajouté une ligne puis changé d'avis.
      attributes: Object.fromEntries(
        attributes
          .filter((row) => row.key.trim() && row.value.trim())
          .map((row) => [row.key.trim(), row.value.trim()]),
      ),
    }

    if (variant) {
      update.mutate({ variantId: variant.id, input: payload }, { onSuccess: () => onOpenChange(false) })
    } else {
      add.mutate(payload, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={variant ? t('variants.form.editTitle') : t('variants.form.newTitle')}
      description={t('variants.form.subtitle')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending} disabled={!canSubmit}>
            {variant ? t('products.form.save') : t('variants.form.create')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-md">
        {error && !error.fields && <Alert variant="danger">{t(error.userMessageKey)}</Alert>}

        <TextInput
          label={t('variants.columns.name')}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          helperText={t('variants.form.nameHint')}
        />

        <TextInput
          label={t('variants.columns.sku')}
          required
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          error={fieldError('sku')}
          helperText={t('variants.form.skuHint')}
        />

        <div className="grid gap-md sm:grid-cols-2">
          <TextInput
            label={t('products.form.price', { currency })}
            type="number"
            inputMode="numeric"
            min={0}
            required
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
          <TextInput
            label={t('products.columns.stock')}
            type="number"
            inputMode="numeric"
            min={0}
            required
            value={stock}
            onChange={(event) => setStock(event.target.value)}
          />
        </div>

        <fieldset className="flex flex-col gap-sm">
          <legend className="text-sm font-medium text-text-primary">
            {t('variants.form.attributes')}
          </legend>
          <p className="text-xs text-text-secondary">{t('variants.form.attributesHint')}</p>

          {attributes.map((row, index) => (
            <div key={index} className="flex items-end gap-sm">
              <div className="flex-1">
                <TextInput
                  label={t('variants.form.attributeKey')}
                  placeholder="Couleur"
                  value={row.key}
                  onChange={(event) =>
                    setAttributes((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, key: event.target.value } : r)),
                    )
                  }
                />
              </div>
              <div className="flex-1">
                <TextInput
                  label={t('variants.form.attributeValue')}
                  placeholder="Noir"
                  value={row.value}
                  onChange={(event) =>
                    setAttributes((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, value: event.target.value } : r)),
                    )
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('variants.form.removeAttribute')}
                onClick={() => setAttributes((rows) => rows.filter((_, i) => i !== index))}
              >
                ✕
              </Button>
            </div>
          ))}

          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAttributes((rows) => [...rows, { key: '', value: '' }])}
            >
              {t('variants.form.addAttribute')}
            </Button>
          </div>
        </fieldset>
      </div>
    </Modal>
  )
}
