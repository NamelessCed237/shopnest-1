import type {
  CursorPage,
  ListOrdersQuery,
  Order,
  RefundOrderInput,
  UpdateOrderStatusInput,
} from '@shopnest/contracts'
import type { ApiClient, RequestOptions } from '../client.js'

export function ordersEndpoints(client: ApiClient) {
  return {
    list: (query: Partial<ListOrdersQuery>, options?: RequestOptions) =>
      client.get<CursorPage<Order>>('/orders', query, options),

    detail: (id: string, options?: RequestOptions) =>
      client.get<Order>(`/orders/${id}`, undefined, options),

    /**
     * Les deux mutations renvoient la commande COMPLÈTE.
     *
     * Un changement de statut modifie aussi le paiement (payée → encaissé), et
     * un remboursement peut faire basculer le statut. Renvoyer `void` ou le
     * seul statut obligerait le client à déduire le reste — c'est-à-dire à
     * rejouer des règles qui vivent dans le contrat.
     *
     * `idempotencyKey` est porté par le corps de requête (doc/03 §6) : rejouer
     * l'appel après une coupure renvoie exactement la même commande, sans
     * appliquer deux fois la transition.
     */
    updateStatus: (id: string, input: UpdateOrderStatusInput, options?: RequestOptions) =>
      client.patch<Order>(`/orders/${id}/status`, input, options),

    refund: (id: string, input: RefundOrderInput, options?: RequestOptions) =>
      client.post<Order>(`/orders/${id}/refund`, input, options),
  }
}
