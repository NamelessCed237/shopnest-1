import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminKeys } from '@shopnest/api-client'
import type {
  AdminTenant,
  AppError,
  CursorPage,
  ListTenantsQuery,
  PlanCode,
  PlatformSummary,
  TenantTheme,
} from '@shopnest/contracts'
import { api } from '@/lib/api'

export type TenantFilters = Partial<Pick<ListTenantsQuery, 'search' | 'status' | 'planCode'>>

export function usePlatformSummary() {
  return useQuery<PlatformSummary, AppError>({
    queryKey: adminKeys.summary(),
    queryFn: () => api.admin.summary(),
    staleTime: 5 * 60_000,
  })
}

export function useTenants(filters: TenantFilters) {
  return useInfiniteQuery<CursorPage<AdminTenant>, AppError>({
    queryKey: adminKeys.tenants(filters),
    queryFn: ({ pageParam, signal }) =>
      api.admin.listTenants(
        { ...filters, ...(pageParam ? { cursor: pageParam as string } : {}) },
        { signal },
      ),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor,
  })
}

export function useTenant(id: string) {
  return useQuery<AdminTenant, AppError>({
    queryKey: adminKeys.tenant(id),
    queryFn: () => api.admin.tenant(id),
  })
}

export function useUpdateTenantTheme(id: string) {
  const queryClient = useQueryClient()

  return useMutation<AdminTenant, AppError, TenantTheme>({
    mutationFn: (theme) => api.admin.updateTheme(id, theme),
    onSuccess: (updated) => {
      queryClient.setQueryData(adminKeys.tenant(id), updated)
      // La LISTE porte aussi le thème (pastille de couleur) : la laisser en
      // cache afficherait l'ancienne teinte au retour en arrière.
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'tenants'] })
    },
  })
}

export function useUpdateTenantPlan(id: string) {
  const queryClient = useQueryClient()

  return useMutation<AdminTenant, AppError, PlanCode>({
    mutationFn: (planCode) => api.admin.updatePlan(id, planCode),
    onSuccess: (updated) => {
      queryClient.setQueryData(adminKeys.tenant(id), updated)
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'tenants'] })
    },
  })
}
