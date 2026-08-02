import { Dropdown, type DropdownProps } from '@shopnest/ui-web'
import { entityResolver } from '@/lib/api'

/**
 * doc/07 §3.7 — WRAPPER MÉTIER.
 *
 * Le Dropdown reste ignorant du métier (R2) ; la connaissance « une catégorie se
 * charge depuis /categories » vit ici, dans la feature. Cinq lignes : la complexité
 * est mutualisée en bas, la spécialisation est triviale en haut.
 */
export function CategorySelect(props: Omit<DropdownProps<string>, 'source' | 'label'>) {
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
