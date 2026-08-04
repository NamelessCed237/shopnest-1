import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { TenantFilterBar, TenantsTable, type TenantFilters } from '@/features/tenants'

/**
 * doc/04 §3 — les filtres vivent dans l'URL : un lien partagé rouvre la même
 * vue, et le retour arrière du navigateur les restaure.
 */
export function TenantsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const filters = useSearch({ from: '/authenticated/tenants' }) as TenantFilters

  const patch = (next: TenantFilters) =>
    void navigate({ to: '/tenants', search: { ...filters, ...next }, replace: true })

  return (
    <div className="flex flex-col gap-lg">
      <header>
        <h1 className="text-xl font-semibold text-text-primary">{t('admin.tenants.title')}</h1>
        <p className="text-sm text-text-secondary">{t('admin.tenants.subtitle')}</p>
      </header>

      <TenantFilterBar
        filters={filters}
        onChange={patch}
        onReset={() => void navigate({ to: '/tenants', search: {}, replace: true })}
      />

      <TenantsTable filters={filters} />
    </div>
  )
}
