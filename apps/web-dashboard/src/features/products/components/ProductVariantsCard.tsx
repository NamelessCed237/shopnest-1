import { useState } from 'react'
import type { Product, ProductVariant } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Badge, Button, Card, EmptyState, Modal } from '@shopnest/ui-web'
import { useRemoveVariant } from '../api/use-variant-mutations'
import { VariantFormDialog } from './VariantFormDialog'

/**
 * doc §10.1 du cahier des charges — gestion des variantes.
 *
 * Les variantes vivent DANS l'écran produit et non sur une route dédiée :
 * elles n'ont aucun sens hors de leur produit, et le vendeur les compare
 * entre elles pendant qu'il les saisit.
 */
export function ProductVariantsCard({ product }: { product: Product }) {
  const { t, money, number } = useTranslation()
  const remove = useRemoveVariant(product.id)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProductVariant | undefined>()
  const [pendingDelete, setPendingDelete] = useState<ProductVariant | undefined>()

  const hasVariants = product.variants.length > 0

  return (
    <Card
      title={t('variants.title')}
      description={t('variants.subtitle')}
      action={
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setFormOpen(true)
          }}
        >
          {t('variants.actions.add')}
        </Button>
      }
      padded={false}
    >
      {/*
        Le stock et le prix du produit deviennent DÉRIVÉS dès la première
        variante. On l'annonce ici, sinon le vendeur croit que ses champs
        produit ont été écrasés par erreur.
      */}
      {hasVariants && (
        <div className="border-b border-border-base p-md">
          <Alert variant="info" title={t('variants.derived.title')}>
            {t('variants.derived.body', {
              stock: number(product.stock),
              price: money(product.price),
            })}
          </Alert>
        </div>
      )}

      {!hasVariants ? (
        <div className="p-md">
          <EmptyState title={t('variants.empty.title')} />
          <p className="mt-sm text-center text-xs text-text-secondary">
            {t('variants.empty.hint')}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border-base">
          {product.variants.map((variant) => (
            <li key={variant.id} className="flex flex-wrap items-center gap-md px-md py-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{variant.name}</p>
                <p className="text-xs text-text-secondary">
                  <span className="font-mono">{variant.sku}</span>
                  {Object.entries(variant.attributes).length > 0 && (
                    <span className="ms-sm">
                      {Object.entries(variant.attributes)
                        .map(([key, value]) => `${key} : ${value}`)
                        .join(' · ')}
                    </span>
                  )}
                </p>
              </div>

              <span className="shrink-0 text-sm tabular-nums text-text-primary">
                {money(variant.price)}
              </span>

              <span className="shrink-0">
                {variant.stock === 0 ? (
                  <Badge variant="danger">{t('products.stock.out')}</Badge>
                ) : (
                  <span className="text-sm tabular-nums text-text-secondary">
                    {t('variants.inStock', { count: number(variant.stock) })}
                  </span>
                )}
              </span>

              <div className="flex shrink-0 gap-xs">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditing(variant)
                    setFormOpen(true)
                  }}
                >
                  {t('categories.actions.edit')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPendingDelete(variant)}>
                  {t('categories.actions.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <VariantFormDialog
        productId={product.id}
        currency={product.price.currency}
        open={formOpen}
        onOpenChange={setFormOpen}
        variant={editing}
      />

      <Modal
        open={pendingDelete !== undefined}
        onOpenChange={(open) => !open && setPendingDelete(undefined)}
        title={t('variants.delete.title')}
        description={t('variants.delete.body', { name: pendingDelete?.name ?? '' })}
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
          {remove.error && <Alert variant="danger">{t(remove.error.userMessageKey)}</Alert>}

          {/* Cas particulier : retirer la dernière variante rend au produit son
              propre stock et son propre prix. On le dit avant, pas après. */}
          {product.variants.length === 1 && (
            <Alert variant="warning">{t('variants.delete.lastOne')}</Alert>
          )}
        </div>
      </Modal>
    </Card>
  )
}
