import { useState } from 'react'
import {
  MAX_BULK_PRODUCTS,
  PRODUCT_STATUS,
  type BulkProductActionInput,
  type ProductStatus,
} from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Dropdown, Icon } from '@shopnest/ui-web'
import { entityResolver } from '@/lib/api'
import { useBulkProducts } from '../api/use-bulk-products'

export interface BulkActionBarProps {
  selectedIds: string[]
  onClear: () => void
}

/**
 * Barre d'actions groupées — n'apparaît QUE lorsqu'une ligne est cochée.
 *
 * Elle est ancrée en bas de l'écran plutôt qu'au-dessus du tableau : la
 * sélection se fait en parcourant les lignes, souvent après avoir fait défiler,
 * et une barre en tête d'écran serait hors champ au moment de valider.
 */
export function BulkActionBar({ selectedIds, onClear }: BulkActionBarProps) {
  const { t, tp } = useTranslation()
  const mutation = useBulkProducts()
  const [status, setStatus] = useState<ProductStatus | undefined>()
  const [categoryId, setCategoryId] = useState<string | undefined>()

  if (selectedIds.length === 0) return null

  const tooMany = selectedIds.length > MAX_BULK_PRODUCTS

  const run = (input: BulkProductActionInput) =>
    mutation.mutate(input, {
      // La sélection est vidée APRÈS coup : la garder afficherait une barre
      // qui parle de lignes que le tableau vient de renommer ou de retirer.
      onSuccess: () => {
        setStatus(undefined)
        setCategoryId(undefined)
        onClear()
      },
    })

  return (
    <div className="sticky bottom-md z-dropdown mx-auto flex w-full max-w-4xl flex-wrap items-center gap-md rounded-lg border border-border-base bg-surface-base p-md shadow-lg">
      <span className="text-sm font-medium text-text-primary">
        {tp('products.bulk.selected', selectedIds.length, { count: selectedIds.length })}
      </span>

      {tooMany ? (
        <Alert variant="warning">
          {t('products.bulk.tooMany', { max: MAX_BULK_PRODUCTS })}
        </Alert>
      ) : (
        <>
          <div className="w-44">
            <Dropdown<ProductStatus>
              placeholder={t('products.bulk.setStatus')}
              source={PRODUCT_STATUS.map((value) => ({
                value,
                label: t(`products.status.${value}`),
              }))}
              value={status}
              onChange={(next) => {
                setStatus(next)
                if (next) run({ action: 'setStatus', ids: selectedIds, status: next })
              }}
            />
          </div>

          <div className="w-52">
            <Dropdown
              placeholder={t('products.bulk.addCategory')}
              searchable
              source={{ entity: 'categories' }}
              entityResolver={entityResolver}
              value={categoryId}
              onChange={(next) => {
                setCategoryId(next)
                if (next) run({ action: 'addCategory', ids: selectedIds, categoryId: next })
              }}
            />
          </div>

          <Button
            variant="secondary"
            loading={mutation.isPending}
            onClick={() => run({ action: 'archive', ids: selectedIds })}
          >
            {t('products.bulk.archive')}
          </Button>
        </>
      )}

      {/* `ms-auto` sur l'enveloppe : le Button refuse tout className venu de
          l'extérieur (R8), et c'est bien un choix de mise en page, pas de style. */}
      <div className="ms-auto">
        <Button variant="ghost" onClick={onClear} leadingIcon={<Icon name="close" />}>
          {t('products.bulk.clear')}
        </Button>
      </div>

      {mutation.isSuccess && (
        <span className="w-full text-xs text-status-success">
          {tp('products.bulk.done', mutation.data.affected, { count: mutation.data.affected })}
        </span>
      )}

      {mutation.error && (
        <span className="w-full text-xs text-status-danger">
          {t(mutation.error.userMessageKey)}
        </span>
      )}
    </div>
  )
}
