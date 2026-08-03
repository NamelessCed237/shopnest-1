import { useTranslation } from '@shopnest/i18n/react'
import { PreferencesControls } from './PreferencesControls'

/**
 * En-tête de la boutique publique.
 *
 * Le storefront est le seul écran indexable et le seul chargé en 4G par des
 * acheteurs : aucun composant lourd ici, pas de dépendance au routeur applicatif.
 */
export function StorefrontHeader({ cartCount = 0 }: { cartCount?: number }) {
  const { t, tp } = useTranslation()

  return (
    <header className="sticky top-0 z-dropdown border-b border-border-base bg-surface-base/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-md px-md py-sm">
        <a href="/" className="text-lg font-bold text-text-primary">
          ShopNest
        </a>

        <nav aria-label={t('nav.main')} className="flex items-center gap-md text-sm">
          <a
            href="/"
            aria-current="page"
            className="border-b-2 border-brand-primary pb-xs font-medium text-brand-primary"
          >
            {t('storefront.nav.shop')}
          </a>
          <a href="/categories" className="text-text-secondary hover:text-text-primary">
            {t('storefront.nav.categories')}
          </a>
          <a href="/deals" className="text-text-secondary hover:text-text-primary">
            {t('storefront.nav.deals')}
          </a>
        </nav>

        <form
          role="search"
          className="ms-auto flex min-w-48 flex-1 items-center justify-end gap-sm"
          onSubmit={(event) => event.preventDefault()}
        >
          <label htmlFor="storefront-search" className="sr-only">
            {t('storefront.search.label')}
          </label>
          <div className="relative w-full max-w-xs">
            <input
              id="storefront-search"
              type="search"
              placeholder={t('storefront.search.placeholder')}
              className="w-full rounded-full border border-border-base bg-surface-raised px-md py-xs pe-2xl text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
            <button
              type="submit"
              aria-label={t('storefront.search.submit')}
              className="absolute end-xs top-1/2 -translate-y-1/2 text-text-secondary"
            >
              <SearchIcon />
            </button>
          </div>

          <a
            href="/cart"
            className="relative grid h-9 w-9 place-items-center rounded-full text-text-secondary hover:text-text-primary"
            aria-label={tp('storefront.nav.cart', cartCount, { count: cartCount })}
          >
            <CartIcon />
            {cartCount > 0 && (
              <span className="absolute -end-xs -top-xs grid h-4 min-w-4 place-items-center rounded-full bg-brand-primary px-xs text-[10px] font-bold text-brand-onPrimary">
                {cartCount}
              </span>
            )}
          </a>

          <PreferencesControls />

          <a
            href="/account"
            className="grid h-9 w-9 place-items-center rounded-full text-text-secondary hover:text-text-primary"
            aria-label={t('storefront.nav.account')}
          >
            <UserIcon />
          </a>
        </form>
      </div>
    </header>
  )
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 } as const

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20" r="1.2" fill="currentColor" />
      <circle cx="18" cy="20" r="1.2" fill="currentColor" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
    </svg>
  )
}
