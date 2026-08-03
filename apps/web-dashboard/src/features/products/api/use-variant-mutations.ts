import { useMutation, useQueryClient } from '@tanstack/react-query'
import { analyticsKeys, productKeys } from '@shopnest/api-client'
import type {
  AppError,
  CreateVariantInput,
  Product,
  UpdateVariantInput,
} from '@shopnest/contracts'
import { api } from '@/lib/api'

/**
 * Les trois mutations renvoient le PRODUIT complet, pas la variante.
 *
 * Ajouter une variante change le stock et le prix dérivés du produit : ne
 * renvoyer que la variante obligerait le client à recalculer ces valeurs
 * lui-même, donc à dupliquer une règle métier qui vit dans le contrat.
 */
function useVariantInvalidation() {
  const queryClient = useQueryClient()

  return (product: Product) => {
    queryClient.setQueryData(productKeys.detail(product.id), product)
    void queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    // Le stock dérivé alimente les alertes du tableau de bord.
    void queryClient.invalidateQueries({ queryKey: analyticsKeys.all })
  }
}

export function useAddVariant(productId: string) {
  const invalidate = useVariantInvalidation()

  return useMutation<Product, AppError, CreateVariantInput>({
    mutationFn: (input) => api.products.addVariant(productId, input),
    onSuccess: invalidate,
    retry: false,
  })
}

export function useUpdateVariant(productId: string) {
  const invalidate = useVariantInvalidation()

  return useMutation<Product, AppError, { variantId: string; input: UpdateVariantInput }>({
    mutationFn: ({ variantId, input }) => api.products.updateVariant(productId, variantId, input),
    onSuccess: invalidate,
    retry: false,
  })
}

export function useRemoveVariant(productId: string) {
  const invalidate = useVariantInvalidation()

  return useMutation<Product, AppError, string>({
    mutationFn: (variantId) => api.products.removeVariant(productId, variantId),
    onSuccess: invalidate,
    retry: false,
  })
}
