import type { CheckoutInput, CheckoutResult, OrderTracking } from '@shopnest/contracts'
import type { ApiClient, RequestOptions } from '../client.js'

export function checkoutEndpoints(client: ApiClient) {
  return {
    /**
     * Passe la commande.
     *
     * `idempotencyKey` est dans le CORPS et non dans l'en-tête `Idempotency-Key`
     * que `ApiClient` sait poser : le contrat en fait un champ obligatoire,
     * validé par le même schéma que le reste. Un en-tête serait facultatif par
     * construction, et l'oublier ne casserait rien de visible — jusqu'au jour
     * où une reprise réseau crée une seconde commande.
     */
    create: (input: CheckoutInput, options?: RequestOptions) =>
      client.post<CheckoutResult>('/checkout', input, options),

    /** Suivi par laissez-passer, sans compte. */
    track: (token: string, options?: RequestOptions) =>
      client.get<OrderTracking>(`/checkout/track/${encodeURIComponent(token)}`, undefined, options),
  }
}
