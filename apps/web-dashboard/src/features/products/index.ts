/** doc/04 §2 — SEUL point d'entrée public de la feature. */
export { ProductsTable } from './components/ProductsTable'
export { ProductFilters } from './components/ProductFilters'
export { ProductStatusBadge } from './components/ProductStatusBadge'
export { ProductForm } from './components/ProductForm'
export { ProductVariantsCard } from './components/ProductVariantsCard'
export { VariantFormDialog } from './components/VariantFormDialog'
export { useProducts, type ProductFilters as ProductFiltersValue } from './api/use-products'
export {
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useArchiveProduct,
} from './api/use-product-mutations'
export {
  useAddVariant,
  useUpdateVariant,
  useRemoveVariant,
} from './api/use-variant-mutations'
