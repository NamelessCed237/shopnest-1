import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { categoryKeys, productKeys } from '@shopnest/api-client'
import type {
  AppError,
  Category,
  CategoryWithCounts,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@shopnest/contracts'
import { api } from '@/lib/api'

export function useCategories(search?: string) {
  return useQuery<CategoryWithCounts[], AppError>({
    queryKey: [...categoryKeys.all, 'list', search ?? ''],
    queryFn: ({ signal }) => api.categories.list({ search }, { signal }),
    placeholderData: (previous) => previous,
  })
}

function useCategoryInvalidation() {
  const queryClient = useQueryClient()

  return () => {
    void queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    // Les produits portent des categoryIds et les listes filtrent dessus :
    // renommer ou supprimer une catégorie change ce que ces écrans affichent.
    void queryClient.invalidateQueries({ queryKey: productKeys.all })
  }
}

export function useCreateCategory() {
  const invalidate = useCategoryInvalidation()

  return useMutation<Category, AppError, CreateCategoryInput>({
    mutationFn: (input) => api.categories.create(input),
    onSuccess: invalidate,
    retry: false,
  })
}

export function useUpdateCategory() {
  const invalidate = useCategoryInvalidation()

  return useMutation<Category, AppError, { id: string; input: UpdateCategoryInput }>({
    mutationFn: ({ id, input }) => api.categories.update(id, input),
    onSuccess: invalidate,
    retry: false,
  })
}

export function useDeleteCategory() {
  const invalidate = useCategoryInvalidation()

  return useMutation<{ id: string }, AppError, string>({
    mutationFn: (categoryId) => api.categories.remove(categoryId),
    onSuccess: invalidate,
    // Un refus « catégorie utilisée » ne se résout pas en réessayant.
    retry: false,
  })
}
