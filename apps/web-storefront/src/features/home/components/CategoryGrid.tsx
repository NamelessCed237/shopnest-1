import { useTranslation } from '@shopnest/i18n/react'
import { MediaPlaceholder } from '@/components/media/MediaPlaceholder'
import { fakeCategories, type StorefrontCategory } from '@/lib/fake/storefront.fixtures'
import { SectionHeader } from './SectionHeader'

/**
 * Grille asymétrique : la première catégorie occupe deux rangées.
 * Le découpage est piloté par l'INDEX, pas par un identifiant en dur — la mise
 * en page survit à un changement de catalogue côté vendeur.
 */
export function CategoryGrid() {
  const { t, tp } = useTranslation()
  const [first, ...rest] = fakeCategories

  return (
    <section>
      <SectionHeader
        title={t('storefront.categories.title')}
        subtitle={t('storefront.categories.subtitle')}
        actionLabel={t('storefront.categories.viewAll')}
        actionHref="/categories"
      />

      <div className="grid gap-md md:grid-cols-2">
        {first && <CategoryTile category={first} className="md:row-span-2 md:min-h-72" />}

        <div className="grid gap-md sm:grid-cols-2">
          {rest.slice(0, 2).map((category) => (
            <CategoryTile key={category.id} category={category} className="min-h-32" />
          ))}
        </div>

        {rest[2] && <CategoryTile category={rest[2]} className="min-h-32 sm:col-span-2" />}
      </div>

      <span className="sr-only">
        {tp('storefront.categories.count', fakeCategories.length, {
          count: fakeCategories.length,
        })}
      </span>
    </section>
  )
}

function CategoryTile({
  category,
  className,
}: {
  category: StorefrontCategory
  className?: string
}) {
  const { tp } = useTranslation()

  return (
    <a
      href={`/categories/${category.slug}`}
      className={`group relative block overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus ${className ?? ''}`}
    >
      <MediaPlaceholder tone={category.tone} label={category.name} className="h-full w-full" />

      {/* Voile bas : garantit le contraste du libellé quelle que soit la photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      <div className="absolute bottom-0 start-0 p-md">
        <p className="text-base font-semibold text-white">{category.name}</p>
        <p className="text-xs text-white/80">
          {tp('storefront.categories.products', category.productCount, {
            count: category.productCount,
          })}
        </p>
      </div>
    </a>
  )
}
