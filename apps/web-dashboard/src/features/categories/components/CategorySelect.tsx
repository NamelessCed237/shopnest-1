import { Dropdown, type DropdownWrapperProps } from '@shopnest/ui-web'
import { entityResolver } from '@/lib/api'

/**
 * doc/07 §3.7 — WRAPPER MÉTIER.
 *
 * Le Dropdown reste ignorant du métier (R2) ; la connaissance « une catégorie se
 * charge depuis /categories » vit ici, dans la feature. Cinq lignes : la complexité
 * est mutualisée en bas, la spécialisation est triviale en haut.
 *
 * `DropdownWrapperProps` et non `Omit` : un `Omit` classique fusionnerait les
 * deux variantes de l'union et ce wrapper cesserait d'accepter `multiple`.
 */
export function CategorySelect(props: DropdownWrapperProps<string, 'source' | 'label'>) {
  return (
    <Dropdown
      {...props}
      label="Catégorie"
      source={{ entity: 'categories', params: { includeEmpty: false } }}
      entityResolver={entityResolver}
      searchable
    />
  )
}
