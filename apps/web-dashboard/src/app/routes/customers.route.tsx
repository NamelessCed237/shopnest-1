import { useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { CustomerFilters, CustomersTable, SegmentSummary } from '@/features/customers'
import type { CustomersSearch } from '../search-schemas'

export function CustomersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ from: '/authenticated/customers' })

  // Objet fusionné plutôt que réducteur : la forme réducteur reçoit l'union des
  // `search` de TOUTES les routes, donc un type qui n'est pas celui de cet écran.
  const patchSearch = useCallback(
    (patch: Partial<CustomersSearch>) => {
      void navigate({ to: '/customers', search: { ...search, ...patch }, replace: true })
    },
    [navigate, search],
  )

  const resetFilters = useCallback(() => {
    void navigate({
      to: '/customers',
      search: { sortBy: search.sortBy, sortOrder: search.sortOrder },
      replace: true,
    })
  }, [navigate, search.sortBy, search.sortOrder])

  return (
    <div className="flex flex-col gap-lg">
      <header>
        <h1 className="text-xl font-semibold text-text-primary">{t('customers.title')}</h1>
        <p className="text-sm text-text-secondary">{t('customers.subtitle')}</p>
      </header>

      <SegmentSummary
        activeSegment={search.segment}
        onSelect={(segment) => patchSearch({ segment })}
      />

      <CustomerFilters filters={search} onChange={patchSearch} onReset={resetFilters} />

      <CustomersTable
        filters={search}
        onSortChange={(sortBy, sortOrder) => patchSearch({ sortBy, sortOrder })}
        onResetFilters={resetFilters}
        onOpenCustomer={(customerId) =>
          void navigate({ to: '/customers/$customerId', params: { customerId } })
        }
      />
    </div>
  )
}
