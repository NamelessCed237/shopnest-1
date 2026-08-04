import { useEffect, useRef, useState } from 'react'
import {
  ORDER_STATUS,
  PAYMENT_METHODS,
  type OrderStatus,
  type PaymentMethod,
} from '@shopnest/contracts'
import { useDebouncedValue } from '@shopnest/core'
import { useTranslation } from '@shopnest/i18n/react'
import { Button, Dropdown, TextInput } from '@shopnest/ui-web'
import type { OrderFilters as Filters } from '../api/use-orders'

export interface OrderFiltersProps {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
  onReset: () => void
}

export function OrderFilters({ filters, onChange, onReset }: OrderFiltersProps) {
  const { t } = useTranslation()

  // Même mécanique que l'écran produits : l'URL n'est mise à jour qu'après
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

  const hasActiveFilter = Boolean(filters.search || filters.status || filters.paymentMethod)

  return (
    <div className="flex flex-wrap items-end gap-md">
      <div className="min-w-56 flex-1">
        <TextInput
          label={t('orders.filters.search')}
          type="search"
          placeholder={t('orders.filters.searchPlaceholder')}
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
        />
      </div>

      <div className="w-52">
        <Dropdown<OrderStatus>
          label={t('orders.filters.status')}
          placeholder={t('products.filters.all')}
          clearable
          source={ORDER_STATUS.map((status) => ({
            value: status,
            label: t(`orders.status.${status}`),
          }))}
          value={filters.status}
          onChange={(status) => onChange({ status })}
        />
      </div>

      <div className="w-52">
        <Dropdown<PaymentMethod>
          label={t('orders.filters.paymentMethod')}
          placeholder={t('products.filters.all')}
          clearable
          source={PAYMENT_METHODS.map((method) => ({
            value: method,
            label: t(`orders.paymentMethod.${method}`),
          }))}
          value={filters.paymentMethod}
          onChange={(paymentMethod) => onChange({ paymentMethod })}
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
