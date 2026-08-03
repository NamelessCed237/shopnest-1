import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { analyticsKeys, productKeys } from '@shopnest/api-client'
import type {
  AppError,
  CreateProductInput,
  Product,
  UpdateProductInput,
} from '@shopnest/contracts'
import { api } from '@/lib/api'

export function useProduct(productId: string) {
  return useQuery<Product, AppError>({
    queryKey: productKeys.detail(productId),
    queryFn: ({ signal }) => api.products.detail(productId, { signal }),
    // Une fiche introuvable ne le devient pas en réessayant.
    retry: false,
  })
}

function useProductInvalidation() {
  const queryClient = useQueryClient()

  return (product: Product) => {
    queryClient.setQueryData(productKeys.detail(product.id), product)
    // Les listes, le compteur de stock bas et les tuiles du tableau de bord
    // dépendent du catalogue : les invalider évite deux vérités à l'écran.
    void queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    void queryClient.invalidateQueries({ queryKey: analyticsKeys.all })
  }
}

export function useCreateProduct() {
  const invalidate = useProductInvalidation()

  return useMutation<Product, AppError, CreateProductInput>({
    mutationFn: (input) => api.products.create(input),
    onSuccess: invalidate,
    // Un quota dépassé ou un slug pris ne se résout pas en réessayant.
    retry: false,
  })
}

export function useUpdateProduct(productId: string) {
  const invalidate = useProductInvalidation()

  return useMutation<Product, AppError, UpdateProductInput>({
    mutationFn: (input) => api.products.update(productId, input),
    onSuccess: invalidate,
    retry: false,
  })
}

/**
 * ARCHIVAGE et non suppression — doc/03 §4.
 *
 * Un produit référencé par une commande ne se supprime pas : l'historique
 * d'achat afficherait une ligne vide. L'archivage le retire du catalogue tout
 * en préservant les commandes passées.
 */
export function useArchiveProduct(productId: string) {
  const invalidate = useProductInvalidation()

  return useMutation<Product, AppError, void>({
    mutationFn: () => api.products.archive(productId),
    onSuccess: invalidate,
    retry: false,
  })
}
