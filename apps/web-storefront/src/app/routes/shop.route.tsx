import { useState } from 'react'
import type { CheckoutResult } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Button, Icon } from '@shopnest/ui-web'
import { StorefrontFooter } from '@/components/layout/StorefrontFooter'
import { StorefrontHeader } from '@/components/layout/StorefrontHeader'
import { CartPanel } from '@/features/cart/components/CartPanel'
import { cartCount, useCart } from '@/features/cart/store'
import { CatalogGrid } from '@/features/catalog/components/CatalogGrid'
import { CheckoutForm } from '@/features/checkout/components/CheckoutForm'
import { PaymentStep } from '@/features/checkout/components/PaymentStep'

/**
 * Le tunnel d'achat, en QUATRE étapes dans une seule page.
 *
 * Pas de routeur, et c'est délibéré : `main.tsx` porte depuis le début un
 * TODO(#8) « routeur + rendu serveur », les deux allant ensemble. Le storefront
 * est le seul écran indexable du produit ; il devra être rendu côté serveur, ce
 * qui déterminera la forme de son routage. Poser un routeur client maintenant
 * reviendrait à choisir cette forme à l'aveugle, puis à la défaire.
 *
 * Ce que cela coûte, et qu'il faut assumer : les étapes n'ont pas d'URL. On ne
 * peut ni partager un lien vers une fiche produit, ni revenir en arrière avec
 * le bouton du navigateur. Inacceptable pour une vraie boutique, sans
 * conséquence pour vérifier que la chaîne panier → paiement → confirmation
 * fonctionne — ce qui est le but ici.
 */
type Step = 'catalog' | 'cart' | 'checkout' | 'payment'

export function ShopPage() {
  const { t, tp } = useTranslation()
  const lines = useCart((state) => state.lines)
  const [step, setStep] = useState<Step>('catalog')
  const [result, setResult] = useState<CheckoutResult>()

  // `tp` et non `t` : la clé a une forme au singulier et une au pluriel
  // (`_one` / `_other`). Avec `t`, aucune des deux ne correspond et c'est la
  // clé BRUTE qui s'affiche — « storefront.steps.cart » dans le fil d'ariane.
  const count = cartCount(lines)
  const cartLabel = tp('storefront.steps.cart', count, { count })

  return (
    <div className="min-h-screen bg-surface-raised">
      <StorefrontHeader cartCount={count} />

      <main className="mx-auto flex max-w-7xl flex-col gap-lg px-md py-lg">
        <nav className="flex flex-wrap items-center gap-sm text-sm">
          <StepLink
            active={step === 'catalog'}
            onClick={() => setStep('catalog')}
            label={t('storefront.steps.catalog')}
          />
          <Icon name="chevron-right" />
          <StepLink
            active={step === 'cart'}
            onClick={() => setStep('cart')}
            label={cartLabel}
          />
          <Icon name="chevron-right" />
          <StepLink
            active={step === 'checkout' || step === 'payment'}
            // On ne saute pas au paiement avec un panier vide : le formulaire
            // s'afficherait, et le bouton « Payer » resterait inerte sans dire
            // pourquoi.
            onClick={() => lines.length > 0 && setStep('checkout')}
            label={t('storefront.steps.checkout')}
          />
        </nav>

        {step === 'catalog' && (
          <section className="flex flex-col gap-md">
            <div className="flex flex-wrap items-center justify-between gap-md">
              <h1 className="text-xl font-semibold text-text-primary">
                {t('storefront.catalog.title')}
              </h1>
              {lines.length > 0 && (
                <Button variant="secondary" onClick={() => setStep('cart')}>
                  {cartLabel}
                </Button>
              )}
            </div>
            <CatalogGrid />
          </section>
        )}

        {step === 'cart' && (
          <section className="flex flex-col gap-md">
            <h1 className="text-xl font-semibold text-text-primary">{t('storefront.cart.title')}</h1>
            <CartPanel onCheckout={() => setStep('checkout')} />
            <div>
              <Button variant="ghost" onClick={() => setStep('catalog')}>
                {t('storefront.cart.continue')}
              </Button>
            </div>
          </section>
        )}

        {step === 'checkout' && (
          <section className="grid gap-lg lg:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-md">
              <h1 className="text-xl font-semibold text-text-primary">
                {t('storefront.checkout.title')}
              </h1>
              <CheckoutForm
                onPlaced={(placed) => {
                  setResult(placed)
                  setStep('payment')
                }}
              />
            </div>
            <aside className="flex flex-col gap-md rounded-lg border border-border-base bg-surface-base p-md">
              <h2 className="font-medium text-text-primary">{t('storefront.checkout.summary')}</h2>
              {/* Sans `onCheckout` : ici le panier est un rappel, pas une action. */}
              <CartPanel />
            </aside>
          </section>
        )}

        {step === 'payment' && result && (
          <section className="mx-auto flex w-full max-w-2xl flex-col gap-md">
            <PaymentStep result={result} />
            <div>
              <Button variant="ghost" onClick={() => setStep('catalog')}>
                {t('storefront.payment.backToShop')}
              </Button>
            </div>
          </section>
        )}
      </main>

      <StorefrontFooter />
    </div>
  )
}

function StepLink({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'step' : undefined}
      className={
        active
          ? 'font-medium text-brand-primary'
          : 'text-text-secondary hover:text-text-primary'
      }
    >
      {label}
    </button>
  )
}
