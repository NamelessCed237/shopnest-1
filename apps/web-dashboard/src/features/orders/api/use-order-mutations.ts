import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orderKeys, productKeys, analyticsKeys } from '@shopnest/api-client'
import type {
  AppError,
  Order,
  OrderStatus,
  RefundOrderInput,
  UpdateOrderStatusInput,
} from '@shopnest/contracts'
import { api } from '@/lib/api'
import { customerKeys } from '@/features/customers'

/**
 * doc/04 §4 — AUCUNE mise à jour optimiste ici.
 *
 * L'optimisme est réservé aux actions à faible risque (favori, réordonnancement).
 * Afficher « remboursée » avant la confirmation du serveur, puis revenir en
 * arrière en cas d'échec, c'est mentir au vendeur sur un mouvement d'argent.
 */
function useOrderMutationInvalidation() {
  const queryClient = useQueryClient()

  return (order: Order) => {
    queryClient.setQueryData(orderKeys.detail(order.id), order)
    // Les listes, les agrégats client et le tableau de bord dépendent du statut
    // et des montants : les invalider évite d'afficher deux vérités.
    void queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
    void queryClient.invalidateQueries({ queryKey: customerKeys.all })
    void queryClient.invalidateQueries({ queryKey: analyticsKeys.all })
    void queryClient.invalidateQueries({ queryKey: productKeys.all })
  }
}

export function useUpdateOrderStatus(orderId: string) {
  const invalidate = useOrderMutationInvalidation()

  return useMutation<Order, AppError, { status: OrderStatus }>({
    mutationFn: ({ status }) => {
      const input: UpdateOrderStatusInput = {
        status,
        // Clé générée à l'appel : un rejeu du MÊME clic est neutralisé côté
        // serveur, un nouveau clic volontaire produit bien une nouvelle action.
        idempotencyKey: crypto.randomUUID(),
      }
      return api.orders.updateStatus(orderId, input)
    },
    onSuccess: invalidate,
    retry: false,
  })
}

export function useRefundOrder(orderId: string) {
  const invalidate = useOrderMutationInvalidation()

  return useMutation<Order, AppError, { amountCents: number; reason: string }>({
    mutationFn: ({ amountCents, reason }) => {
      const input: RefundOrderInput = {
        amountCents,
        reason,
        idempotencyKey: crypto.randomUUID(),
      }
      return api.orders.refund(orderId, input)
    },
    onSuccess: invalidate,
    // Un remboursement ne se retente JAMAIS automatiquement : le premier appel
    // a peut-être abouti côté prestataire malgré l'erreur réseau.
    retry: false,
  })
}
