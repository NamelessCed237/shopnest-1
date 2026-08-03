/** doc/04 §2 — SEUL point d'entrée public de la feature. */
export { CategoriesTable } from './components/CategoriesTable'
export { CategoryFormDialog } from './components/CategoryFormDialog'
export { CategorySelect } from './components/CategorySelect'
export {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from './api/use-categories'
