import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type {
  AppError,
  CursorPage,
  CustomerSegment,
  CustomerSummary,
  Order,
} from '@shopnest/contracts'
import { api } from '@/lib/api'

export interface CustomerFilters {
  search?: string
  segment?: CustomerSegment
  sortBy?: 'lastOrderAt' | 'totalSpent' | 'orderCount' | 'name'
  sortOrder?: 'asc' | 'desc'
}

/** doc/04 §4 — clés centralisées ; `customerKeys` n'existait pas encore. */
export const customerKeys = {
  all: ['customers'] as const,
  list: (filters: CustomerFilters) => [...customerKeys.all, 'list', filters] as const,
  segments: () => [...customerKeys.all, 'segments'] as const,
  detail: (id: string) => [...customerKeys.all, 'detail', id] as const,
  orders: (id: string) => [...customerKeys.all, 'detail', id, 'orders'] as const,
}

export function useCustomers(filters: CustomerFilters) {
  return useInfiniteQuery<CursorPage<CustomerSummary>, AppError>({
    queryKey: customerKeys.list(filters),
    queryFn: ({ pageParam, signal }) =>
      api.customers.list(
        { ...filters, cursor: pageParam as string | undefined, limit: 20 },
        { signal },
      ),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: (previous) => previous,
  })
}

export function useCustomer(customerId: string) {
  return useQuery<CustomerSummary, AppError>({
    queryKey: customerKeys.detail(customerId),
    queryFn: ({ signal }) => api.customers.detail(customerId, { signal }),
    // Une fiche introuvable ne devient pas trouvable en réessayant : on évite
    // trois allers-retours avant d'afficher le message (doc/04 §4).
    retry: false,
  })
}

export function useCustomerOrders(customerId: string) {
  return useInfiniteQuery<CursorPage<Order>, AppError>({
    queryKey: customerKeys.orders(customerId),
    queryFn: ({ pageParam, signal }) =>
      api.customers.orders(
        customerId,
        { cursor: pageParam as string | undefined, limit: 10 },
        { signal },
      ),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}

export function useCustomerSegments() {
  return useQuery<Record<CustomerSegment, number>, AppError>({
    queryKey: customerKeys.segments(),
    queryFn: () => api.customers.segmentCounts(),
    staleTime: 5 * 60_000,
  })
}
