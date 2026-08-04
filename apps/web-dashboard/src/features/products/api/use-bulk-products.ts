import { useMutation, useQueryClient } from '@tanstack/react-query'
import { productKeys } from '@shopnest/api-client'
import type { AppError, BulkProductActionInput, BulkProductResult } from '@shopnest/contracts'
import { api } from '@/lib/api'

export function useBulkProducts() {
  const queryClient = useQueryClient()

  return useMutation<BulkProductResult, AppError, BulkProductActionInput>({
    mutationFn: (input) => api.products.bulk(input),
    /*
     * On invalide TOUTE la famille produits, sans écriture optimiste.
     *
     * Une action groupée peut changer le statut, la catégorie ou la présence
     * même d'un produit dans la page courante : reconstruire le cache à la
     * main reviendrait à réimplémenter le filtrage et le tri du serveur, avec
     * une chance sur deux de se tromper. Un rechargement est ici plus honnête
     * que rapide.
     */
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}
