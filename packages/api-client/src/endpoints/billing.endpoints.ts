import type { BillingSummary } from '@shopnest/contracts'
import type { ApiClient, RequestOptions } from '../client.js'

export function billingEndpoints(client: ApiClient) {
  return {
    /**
     * Une seule route pour tout l'écran : plan, consommation et relevé.
     *
     * Trois appels séparés donneraient trois états de chargement pour une page
     * qui n'a de sens que complète — et trois chances d'afficher un quota à
     * côté d'une consommation qui ne lui correspond plus.
     */
    summary: (options?: RequestOptions) =>
      client.get<BillingSummary>('/billing/summary', undefined, options),
  }
}
