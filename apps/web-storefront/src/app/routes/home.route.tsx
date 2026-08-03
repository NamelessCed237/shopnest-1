import { useState } from 'react'
import { StorefrontHeader } from '@/components/layout/StorefrontHeader'
import { StorefrontFooter } from '@/components/layout/StorefrontFooter'
import { HeroBanner } from '@/features/home/components/HeroBanner'
import { ValueProps } from '@/features/home/components/ValueProps'
import { CategoryGrid } from '@/features/home/components/CategoryGrid'
import { FeaturedProducts } from '@/features/home/components/FeaturedProducts'
import { NewsletterCta } from '@/features/home/components/NewsletterCta'

/**
 * doc/04 §2 — un fichier de route ASSEMBLE.
 * Chaque section est autonome et vit dans sa feature.
 */
export function HomePage() {
  // Panier local en attendant `useCart` de @shopnest/core (doc/06 §4) : la
  // logique panier sera partagée avec le mobile, elle n'a rien à faire ici.
  const [cartCount, setCartCount] = useState(0)

  return (
    <div className="min-h-screen bg-surface-raised">
      <StorefrontHeader cartCount={cartCount} />

      <main className="mx-auto flex max-w-7xl flex-col gap-xl px-md py-lg">
        <HeroBanner />
        <ValueProps />
        <CategoryGrid />
        <FeaturedProducts onAddToCart={() => setCartCount((count) => count + 1)} />
        <NewsletterCta />
      </main>

      <StorefrontFooter />
    </div>
  )
}
