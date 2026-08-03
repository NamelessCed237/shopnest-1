import { z } from 'zod'

export const CategorySchema = z.object({
  id: z.string().uuid(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'errors.category.invalidSlug'),
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
  /** Catégorie parente. Absent = catégorie de premier niveau. */
  parentId: z.string().uuid().optional(),
  /** Ordre d'affichage dans la boutique, à niveau égal. */
  position: z.number().int().min(0).default(0),
})
export type Category = z.infer<typeof CategorySchema>

/** Vue enrichie : ce que l'écran de gestion affiche réellement. */
export const CategoryWithCountsSchema = CategorySchema.extend({
  /** Produits directement rattachés — hors sous-catégories. */
  productCount: z.number().int().min(0),
  childCount: z.number().int().min(0),
})
export type CategoryWithCounts = z.infer<typeof CategoryWithCountsSchema>

export const CreateCategorySchema = CategorySchema.omit({ id: true })
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>

export const UpdateCategorySchema = CreateCategorySchema.partial()
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>

/**
 * Profondeur maximale de l'arborescence.
 *
 * Deux niveaux suffisent à un catalogue e-commerce et gardent la navigation
 * lisible. Sans limite, un vendeur peut créer une chaîne de 12 niveaux que
 * ni le menu de la boutique ni les filtres ne savent afficher.
 */
export const MAX_CATEGORY_DEPTH = 2

/**
 * Une catégorie ne peut pas devenir sa propre ancêtre.
 *
 * Exporté pour que le backend, les fixtures et les tests appliquent la même
 * règle : un cycle rendrait l'arborescence infinie et ferait boucler tout
 * parcours récursif (menu, fil d'Ariane, réindexation).
 */
export function wouldCreateCycle(
  categoryId: string,
  newParentId: string | undefined,
  parentOf: (id: string) => string | undefined,
): boolean {
  if (!newParentId) return false
  if (newParentId === categoryId) return true

  let cursor = parentOf(newParentId)
  // Borne dure : même si les données sont déjà corrompues, on ne boucle pas.
  for (let depth = 0; cursor && depth <= MAX_CATEGORY_DEPTH + 2; depth += 1) {
    if (cursor === categoryId) return true
    cursor = parentOf(cursor)
  }
  return false
}
