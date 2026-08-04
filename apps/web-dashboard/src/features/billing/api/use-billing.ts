import { useQuery } from '@tanstack/react-query'
import { billingKeys } from '@shopnest/api-client'
import type { AppError, BillingSummary } from '@shopnest/contracts'
import { api } from '@/lib/api'

export function useBillingSummary() {
  return useQuery<BillingSummary, AppError>({
    queryKey: billingKeys.summary(),
    queryFn: () => api.billing.summary(),
    // Les commissions se règlent au mois : les recharger à chaque retour
    // d'onglet coûterait une agrégation sur douze mois pour un chiffre qui
    // n'aura pas bougé.
    staleTime: 10 * 60_000,
  })
}
