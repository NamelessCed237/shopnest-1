import { useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from '@shopnest/i18n/react'
import { Button } from '@shopnest/ui-web'
import { ProductFilters, ProductsTable } from '@/features/products'
import type { ProductsSearch } from '../search-schemas'

/**
 * doc/04 §2 — un fichier de route ASSEMBLE. Toute la logique produits vit dans
 * features/products ; il ne reste ici que le câblage filtres ↔ URL.
 */
export function ProductsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ from: '/authenticated/products' })

  /**
   * doc/04 §3 — les filtres vivent dans l'URL, pas dans un state local.
   * Une liste filtrée doit être partageable par copier-coller du lien et
   * survivre à un rechargement : c'est une exigence produit, pas un détail.
   * `replace` pour ne pas empiler une entrée d'historique par frappe clavier.
   */
  // useCallback : ces fonctions sont des dépendances d'effets côté filtres —
  // une identité changeant à chaque rendu les relancerait inutilement.
  // Objet fusionné plutôt que réducteur : la forme réducteur reçoit l'union des
  // `search` de TOUTES les routes, donc un type qui n'est pas celui de cet écran.
  const patchSearch = useCallback(
    (patch: Partial<ProductsSearch>) => {
      void navigate({ to: '/products', search: { ...search, ...patch }, replace: true })
    },
    [navigate, search],
  )

  const resetFilters = useCallback(() => {
    void navigate({
      to: '/products',
      search: { sortBy: search.sortBy, sortOrder: search.sortOrder },
      replace: true,
    })
  }, [navigate, search.sortBy, search.sortOrder])

  return (
    <div className="flex flex-col gap-lg">
      <header className="flex items-center justify-between gap-md">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t('products.title')}</h1>
          <p className="text-sm text-text-secondary">{t('products.subtitle')}</p>
        </div>
        <Button onClick={() => void navigate({ to: '/products/new' })}>
          {t('products.create')}
        </Button>
      </header>

      <ProductFilters filters={search} onChange={patchSearch} onReset={resetFilters} />

      <ProductsTable
        filters={search}
        onSortChange={(sortBy, sortOrder) => patchSearch({ sortBy, sortOrder })}
        onResetFilters={resetFilters}
        onOpenProduct={(productId) =>
          void navigate({ to: '/products/$productId', params: { productId } })
        }
      />
    </div>
  )
}
