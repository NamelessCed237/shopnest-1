import { useEffect, useRef, useState } from 'react'
import { PRODUCT_STATUS, type ProductStatus } from '@shopnest/contracts'
import { useDebouncedValue } from '@shopnest/core'
import { useTranslation } from '@shopnest/i18n/react'
import { Button, Dropdown, TextInput } from '@shopnest/ui-web'
import { entityResolver } from '@/lib/api'
import type { ProductFilters as Filters } from '../api/use-products'

export interface ProductFiltersProps {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
  onReset: () => void
}

/**
 * doc/07 §3.6 — le MÊME composant Dropdown sert ici deux sources différentes :
 * une liste statique (statut) et une source distante paginée avec recherche
 * serveur (catégorie). Aucun code de chargement n'est écrit dans cet écran.
 */
export function ProductFilters({ filters, onChange, onReset }: ProductFiltersProps) {
  const { t } = useTranslation()

  /**
   * Le champ est piloté localement et ne pousse dans l'URL qu'après 300 ms.
   * Sans cela, chaque frappe change la query key et déclenche une requête :
   * « ordinateur » en produirait 11, dont 10 obsolètes (doc/02 §2.3).
   */
  const [searchDraft, setSearchDraft] = useState(filters.search ?? '')
  const debouncedSearch = useDebouncedValue(searchDraft, 300)
  const lastPushed = useRef(filters.search ?? '')

  useEffect(() => {
    if (debouncedSearch === lastPushed.current) return
    lastPushed.current = debouncedSearch
    onChange({ search: debouncedSearch || undefined })
  }, [debouncedSearch, onChange])

  // Réinitialisation ou retour arrière du navigateur : l'URL redevient la source
  // de vérité et le brouillon local doit se réaligner.
  useEffect(() => {
    const incoming = filters.search ?? ''
    if (incoming === lastPushed.current) return
    lastPushed.current = incoming
    setSearchDraft(incoming)
  }, [filters.search])

  const hasActiveFilter = Boolean(filters.search || filters.status || filters.categoryId)

  return (
    <div className="flex flex-wrap items-end gap-md">
      <div className="min-w-56 flex-1">
        <TextInput
          label={t('products.filters.search')}
          type="search"
          placeholder={t('products.filters.searchPlaceholder')}
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
      </div>

      <div className="w-48">
        <Dropdown<ProductStatus>
          label={t('products.filters.status')}
          placeholder={t('products.filters.all')}
          clearable
          source={PRODUCT_STATUS.map((status) => ({
            value: status,
            label: t(`products.status.${status}`),
          }))}
          value={filters.status}
          onChange={(value) => onChange({ status: value as ProductStatus | undefined })}
        />
      </div>

      <div className="w-56">
        <Dropdown
          label={t('products.filters.category')}
          placeholder={t('products.filters.all')}
          clearable
          searchable
          source={{ entity: 'categories' }}
          entityResolver={entityResolver}
          value={filters.categoryId}
          onChange={(value) => onChange({ categoryId: value as string | undefined })}
        />
      </div>

      {hasActiveFilter && (
        <Button variant="ghost" onClick={onReset}>
          {t('products.filters.reset')}
        </Button>
      )}
    </div>
  )
}
