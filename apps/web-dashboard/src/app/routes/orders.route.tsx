import { useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { OrderFilters, OrdersTable } from '@/features/orders'
import type { OrdersSearch } from '../search-schemas'

export function OrdersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ from: '/authenticated/orders' })

  /**
   * doc/04 §3 — les filtres vivent dans l'URL, pas dans un state local : une liste
   * filtrée doit être partageable par lien et survivre à un rechargement.
   *
   * Objet fusionné plutôt que réducteur : la forme réducteur reçoit l'union des
   * `search` de TOUTES les routes, donc un type qui n'est pas celui de cet écran.
   */
  const patchSearch = useCallback(
    (patch: Partial<OrdersSearch>) => {
      void navigate({ to: '/orders', search: { ...search, ...patch }, replace: true })
    },
    [navigate, search],
  )

  const resetFilters = useCallback(() => {
    void navigate({
      to: '/orders',
      search: { sortBy: search.sortBy, sortOrder: search.sortOrder },
      replace: true,
    })
  }, [navigate, search.sortBy, search.sortOrder])

  return (
    <div className="flex flex-col gap-lg">
      <header>
        <h1 className="text-xl font-semibold text-text-primary">{t('orders.title')}</h1>
        <p className="text-sm text-text-secondary">{t('orders.subtitle')}</p>
      </header>

      <OrderFilters filters={search} onChange={patchSearch} onReset={resetFilters} />

      <OrdersTable
        filters={search}
        onSortChange={(sortBy, sortOrder) => patchSearch({ sortBy, sortOrder })}
        onResetFilters={resetFilters}
        onOpenOrder={(orderId) => void navigate({ to: '/orders/$orderId', params: { orderId } })}
      />
    </div>
  )
}
