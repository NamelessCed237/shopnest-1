import { useState } from 'react'
import { useTranslation } from '@shopnest/i18n/react'
import { MediaPlaceholder } from '@/components/media/MediaPlaceholder'
import { discountPercent, type StorefrontProduct } from '@/lib/fake/storefront.fixtures'
import { Icon } from '@shopnest/ui-web'

export interface ProductCardProps {
  product: StorefrontProduct
  onAddToCart?: (product: StorefrontProduct) => void
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const { t, money } = useTranslation()
  const [wishlisted, setWishlisted] = useState(false)
  const discount = discountPercent(product)

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-border-base bg-surface-base transition-shadow hover:shadow-md">
      <div className="relative">
        <MediaPlaceholder tone={product.tone} label={product.name} className="aspect-[4/3] w-full" />

        {discount !== undefined && (
          <span className="absolute start-sm top-sm rounded-sm bg-status-danger px-sm py-xs text-xs font-bold uppercase tracking-wide text-brand-onPrimary">
            {t('storefront.product.sale', { percent: discount })}
          </span>
        )}

        <button
          type="button"
          onClick={() => setWishlisted((v) => !v)}
          aria-pressed={wishlisted}
          aria-label={t(
            wishlisted ? 'storefront.product.removeWishlist' : 'storefront.product.addWishlist',
            { name: product.name },
          )}
          className="absolute end-sm top-sm grid h-8 w-8 place-items-center rounded-full bg-surface-base/90 text-text-secondary shadow-sm outline-none transition-colors hover:text-status-danger focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <Icon name="heart" filled={wishlisted} size="lg" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-xs p-md">
        <div className="flex items-start justify-between gap-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
            {product.categoryLabel}
          </span>
          <Rating value={product.rating} count={product.reviewCount} />
        </div>

        <h3 className="text-base font-semibold text-text-primary">{product.name}</h3>
        <p className="line-clamp-2 text-sm text-text-secondary">{product.description}</p>

        <div className="mt-auto flex items-end justify-between gap-sm pt-sm">
          <div className="flex flex-col">
            {product.compareAtPrice && (
              // Prix barré : le prix courant reste le dernier lu, donc le plus fort.
              <span className="text-xs text-status-danger line-through">
                {money(product.compareAtPrice)}
              </span>
            )}
            <span className="text-lg font-semibold tabular-nums text-text-primary">
              {money(product.price)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onAddToCart?.(product)}
            aria-label={t('storefront.product.addToCart', { name: product.name })}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-text-primary text-brand-onPrimary outline-none transition-colors hover:bg-brand-primary focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <CartIcon />
          </button>
        </div>
      </div>
    </article>
  )
}

function Rating({ value, count }: { value: number; count: number }) {
  const { locale } = useTranslation()
  return (
    <span
      className="flex shrink-0 items-center gap-xs text-xs text-text-secondary"
      title={`${value} / 5 — ${count} avis`}
    >
      <span className="text-status-success">
        <Icon name="star" filled size="sm" />
      </span>
      <span className="tabular-nums">{value.toLocaleString(locale, { minimumFractionDigits: 1 })}</span>
    </span>
  )
}

function CartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20" r="1.4" fill="currentColor" />
      <circle cx="18" cy="20" r="1.4" fill="currentColor" />
    </svg>
  )
}
