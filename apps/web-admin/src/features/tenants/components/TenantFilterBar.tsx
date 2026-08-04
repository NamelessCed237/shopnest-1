import { useEffect, useRef, useState } from 'react'
import { PLAN_CODES, TENANT_STATUS, type PlanCode, type TenantStatus } from '@shopnest/contracts'
import { useDebouncedValue } from '@shopnest/core'
import { useTranslation } from '@shopnest/i18n/react'
import { Button, Dropdown, TextInput } from '@shopnest/ui-web'
import type { TenantFilters } from '../api/use-tenants'

export interface TenantFilterBarProps {
  filters: TenantFilters
  onChange: (patch: TenantFilters) => void
  onReset: () => void
}

export function TenantFilterBar({ filters, onChange, onReset }: TenantFilterBarProps) {
  const { t } = useTranslation()

  /**
   * Le champ est piloté localement et ne pousse dans l'URL qu'après 300 ms.
   * Sans cela, chaque frappe change la clé de requête : « boutique » en
   * produirait neuf, dont huit obsolètes (doc/02 §2.3).
   */
  const [draft, setDraft] = useState(filters.search ?? '')
  const debounced = useDebouncedValue(draft, 300)
  const lastPushed = useRef(filters.search ?? '')

  useEffect(() => {
    if (debounced === lastPushed.current) return
    lastPushed.current = debounced
    onChange({ search: debounced || undefined })
  }, [debounced, onChange])

  useEffect(() => {
    const incoming = filters.search ?? ''
    if (incoming === lastPushed.current) return
    lastPushed.current = incoming
    setDraft(incoming)
  }, [filters.search])

  const active = Boolean(filters.search || filters.status || filters.planCode)

  return (
    <div className="flex flex-wrap items-end gap-md">
      <div className="min-w-56 flex-1">
        <TextInput
          label={t('admin.tenants.filters.search')}
          type="search"
          placeholder={t('admin.tenants.filters.searchPlaceholder')}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>

      <div className="w-48">
        <Dropdown<TenantStatus>
          label={t('admin.tenants.columns.status')}
          placeholder={t('admin.tenants.filters.all')}
          clearable
          source={TENANT_STATUS.map((status) => ({
            value: status,
            label: t(`admin.tenants.status.${status}`),
          }))}
          value={filters.status}
          onChange={(status) => onChange({ status })}
        />
      </div>

      <div className="w-44">
        <Dropdown<PlanCode>
          label={t('admin.tenants.columns.plan')}
          placeholder={t('admin.tenants.filters.all')}
          clearable
          source={PLAN_CODES.map((code) => ({ value: code, label: code }))}
          value={filters.planCode}
          onChange={(planCode) => onChange({ planCode })}
        />
      </div>

      {active && (
        <Button variant="ghost" onClick={onReset}>
          {t('admin.tenants.filters.reset')}
        </Button>
      )}
    </div>
  )
}
