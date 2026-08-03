import { useRef } from 'react'
import { useTranslation } from '@shopnest/i18n/react'
import { ProductCard } from '@/features/catalog/components/ProductCard'
import { fakeFeaturedProducts, type StorefrontProduct } from '@/lib/fake/storefront.fixtures'
import { SectionHeader } from './SectionHeader'

export function FeaturedProducts({
  onAddToCart,
}: {
  onAddToCart: (product: StorefrontProduct) => void
}) {
  const { t } = useTranslation()
  const trackRef = useRef<HTMLUListElement>(null)

  /**
   * Défilement natif plutôt qu'un carrousel maison : la liste reste navigable
   * au clavier, au doigt et à la molette, et les flèches ne sont qu'un raccourci.
   * Un carrousel qui casse le défilement natif casse aussi l'accessibilité.
   */
  const scrollByCard = (direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector('li')
    const step = card ? card.clientWidth + 16 : track.clientWidth * 0.8
    track.scrollBy({ left: direction * step, behavior: 'smooth' })
  }

  return (
    <section>
      <SectionHeader
        title={t('storefront.featured.title')}
        subtitle={t('storefront.featured.subtitle')}
        action={
          <div className="flex items-center gap-xs">
            <ArrowButton
              direction="previous"
              label={t('storefront.featured.previous')}
              onClick={() => scrollByCard(-1)}
            />
            <ArrowButton
              direction="next"
              label={t('storefront.featured.next')}
              onClick={() => scrollByCard(1)}
            />
          </div>
        }
      />

      <ul
        ref={trackRef}
        className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-md overflow-x-auto pb-sm [scrollbar-width:thin] md:auto-cols-[minmax(0,1fr)] md:grid-flow-row md:grid-cols-4 md:overflow-visible"
      >
        {fakeFeaturedProducts.slice(0, 4).map((product) => (
          <li key={product.id} className="snap-start">
            <ProductCard product={product} onAddToCart={onAddToCart} />
          </li>
        ))}

        {/* Au-delà de 4, les produits restent atteignables par défilement sur mobile. */}
        {fakeFeaturedProducts.slice(4).map((product) => (
          <li key={product.id} className="snap-start md:hidden">
            <ProductCard product={product} onAddToCart={onAddToCart} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ArrowButton({
  direction,
  label,
  onClick,
}: {
  direction: 'previous' | 'next'
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full border border-border-base text-text-secondary outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus"
    >
      <span aria-hidden="true">{direction === 'previous' ? '‹' : '›'}</span>
    </button>
  )
}
