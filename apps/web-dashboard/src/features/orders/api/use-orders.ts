import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { orderKeys } from '@shopnest/api-client'
import type { AppError, CursorPage, Order, OrderStatus, PaymentMethod } from '@shopnest/contracts'
import { api } from '@/lib/api'

export interface OrderFilters {
  search?: string
  status?: OrderStatus
  paymentMethod?: PaymentMethod
  sortBy?: 'createdAt' | 'total'
  sortOrder?: 'asc' | 'desc'
}

export function useOrder(orderId: string) {
  return useQuery<Order, AppError>({
    queryKey: orderKeys.detail(orderId),
    queryFn: ({ signal }) => api.orders.detail(orderId, { signal }),
    // Une commande introuvable ne le devient pas en réessayant.
    retry: false,
  })
}

export function useOrders(filters: OrderFilters) {
  return useInfiniteQuery<CursorPage<Order>, AppError>({
    queryKey: orderKeys.list(filters),
    queryFn: ({ pageParam, signal }) =>
      api.orders.list({ ...filters, cursor: pageParam as string | undefined, limit: 20 }, { signal }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: (previous) => previous,
  })
}
