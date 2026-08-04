import { useQuery } from '@tanstack/react-query'
import type { AppError, CursorPage } from '@shopnest/contracts'
import type { PublicProduct } from '@shopnest/api-client'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Icon } from '@shopnest/ui-web'
import { storefront } from '@/lib/api'
import { useCart } from '@/features/cart/store'

/**
 * La boutique, sur les VRAIES données.
 *
 * Le reste de la page d'accueil tourne encore sur des fixtures : elles décrivent
 * une vitrine idéale — promotions, notes, avis — dont l'API n'a pas encore les
 * équivalents. Cette grille-ci n'affiche que ce qui existe vraiment, parce
 * qu'elle est la seule dont on puisse ensuite acheter le contenu.
 */
export function CatalogGrid() {
  const { t, money } = useTranslation()
  const add = useCart((state) => state.add)

  const query = useQuery<CursorPage<PublicProduct>, AppError>({
    queryKey: ['catalog', 'products'],
    queryFn: ({ signal }) => storefront.catalog.list({ limit: 12 }, { signal }),
  })

  if (query.isPending) {
    return (
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-md">
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="h-72 animate-pulse rounded-lg bg-surface-sunken" />
        ))}
      </ul>
    )
  }

  if (query.isError) {
    return (
      <Alert variant="danger" title={t('storefront.catalog.errorTitle')}>
        {t(query.error.userMessageKey)}
      </Alert>
    )
  }

  const items = query.data?.items ?? []
  if (items.length === 0) {
    return <Alert variant="info">{t('storefront.catalog.empty')}</Alert>
  }

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-md">
      {items.map((product) => (
        <li
          key={product.id}
          className="flex flex-col overflow-hidden rounded-lg border border-border-base bg-surface-base"
        >
          <div className="aspect-square bg-surface-sunken">
            {product.imageUrls[0] ? (
              <img
                src={product.imageUrls[0]}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-text-disabled">
                <Icon name="image" size="lg" />
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-xs p-md">
            <h3 className="font-medium text-text-primary">{product.name}</h3>
            <p className="text-lg font-semibold text-text-primary">{money(product.price)}</p>

            <div className="mt-auto pt-sm">
              {product.inStock ? (
                <Button
                  onClick={() =>
                    add({
                      productId: product.id,
                      name: product.name,
                      slug: product.slug,
                      unitPrice: product.price,
                      ...(product.imageUrls[0] ? { imageUrl: product.imageUrls[0] } : {}),
                    })
                  }
                >
                  {t('storefront.catalog.addToCart')}
                </Button>
              ) : (
                /*
                 * Bouton REMPLACÉ, pas désactivé. Un bouton grisé invite à
                 * cliquer puis laisse chercher pourquoi rien ne se passe ;
                 * une phrase dit ce qu'il en est.
                 */
                <p className="text-sm text-text-secondary">{t('storefront.catalog.outOfStock')}</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
