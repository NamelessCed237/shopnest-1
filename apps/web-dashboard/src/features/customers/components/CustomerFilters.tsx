import { useEffect, useRef, useState } from 'react'
import { CUSTOMER_SEGMENTS, type CustomerSegment } from '@shopnest/contracts'
import { useDebouncedValue } from '@shopnest/core'
import { useTranslation } from '@shopnest/i18n/react'
import { Button, Dropdown, TextInput } from '@shopnest/ui-web'
import type { CustomerFilters as Filters } from '../api/use-customers'

export interface CustomerFiltersProps {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
  onReset: () => void
}

export function CustomerFilters({ filters, onChange, onReset }: CustomerFiltersProps) {
  const { t } = useTranslation()

  // Même mécanique que produits et commandes : l'URL n'est mise à jour qu'après
  // 300 ms, sinon chaque frappe déclenche une requête (doc/02 §2.3).
  const [searchDraft, setSearchDraft] = useState(filters.search ?? '')
  const debouncedSearch = useDebouncedValue(searchDraft, 300)
  const lastPushed = useRef(filters.search ?? '')

  useEffect(() => {
    if (debouncedSearch === lastPushed.current) return
    lastPushed.current = debouncedSearch
    onChange({ search: debouncedSearch || undefined })
  }, [debouncedSearch, onChange])

  useEffect(() => {
    const incoming = filters.search ?? ''
    if (incoming === lastPushed.current) return
    lastPushed.current = incoming
    setSearchDraft(incoming)
  }, [filters.search])

  const hasActiveFilter = Boolean(filters.search || filters.segment)

  return (
    <div className="flex flex-wrap items-end gap-md">
      <div className="min-w-56 flex-1">
        <TextInput
          label={t('customers.filters.search')}
          type="search"
          placeholder={t('customers.filters.searchPlaceholder')}
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
      </div>

      <div className="w-56">
        <Dropdown<CustomerSegment>
          label={t('customers.filters.segment')}
          placeholder={t('products.filters.all')}
          clearable
          source={CUSTOMER_SEGMENTS.map((segment) => ({
            value: segment,
            label: t(`customers.segment.${segment}`),
            description: t(`customers.segment.${segment}.hint`),
          }))}
          value={filters.segment}
          onChange={(segment) => onChange({ segment })}
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
