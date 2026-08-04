import { useQuery } from '@tanstack/react-query'
import { analyticsKeys } from '@shopnest/api-client'
import type { AppError, DashboardRange, StatisticsSummary } from '@shopnest/contracts'
import { api } from '@/lib/api'

export function useStatistics(range: DashboardRange) {
  return useQuery<StatisticsSummary, AppError>({
    queryKey: analyticsKeys.statistics(range),
    queryFn: () => api.analytics.statistics(range),
    // Même durée que le tableau de bord : ce sont les mêmes agrégats vus
    // autrement, les rafraîchir plus souvent ne montrerait rien de nouveau.
    staleTime: 5 * 60_000,
  })
}
