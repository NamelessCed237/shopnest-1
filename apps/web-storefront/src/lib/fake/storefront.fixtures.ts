import type { Money } from '@shopnest/contracts'

/**
 * Vitrine de démonstration — développement sans base.
 *
 * Devise en USD (2 décimales), là où le dashboard vendeur est en XAF (0 décimale) :
 * les deux apps exercent ainsi les deux comportements de `formatMoney`, et une
 * régression sur les devises sans décimale se voit immédiatement.
 */

const usd = (amount: number): Money => ({ amountCents: Math.round(amount * 100), currency: 'USD' })

export interface StorefrontCategory {
  id: string
  name: string
  slug: string
  productCount: number
  /** Teinte du visuel de remplacement, en attendant les vraies photos produit. */
  tone: 'violet' | 'slate' | 'espresso' | 'stone'
}

export const fakeCategories: StorefrontCategory[] = [
  { id: 'c1', name: 'Smartphones', slug: 'smartphones', productCount: 42, tone: 'violet' },
  { id: 'c2', name: 'Ordinateurs portables', slug: 'laptops', productCount: 28, tone: 'slate' },
  { id: 'c3', name: 'Audio', slug: 'audio', productCount: 35, tone: 'espresso' },
  { id: 'c4', name: 'Accessoires', slug: 'accessoires', productCount: 64, tone: 'stone' },
]

export interface StorefrontProduct {
  id: string
  name: string
  slug: string
  categoryLabel: string
  description: string
  price: Money
  /** Prix barré — présent uniquement si le produit est en promotion. */
  compareAtPrice?: Money
  rating: number
  reviewCount: number
  tone: StorefrontCategory['tone']
}

export const fakeFeaturedProducts: StorefrontProduct[] = [
  {
    id: 'p1',
    name: 'Nexus Watch Ultra',
    slug: 'nexus-watch-ultra',
    categoryLabel: 'Wearables',
    description: "Capteurs de santé avancés et suivi GPS pour l'explorateur moderne.",
    price: usd(349),
    rating: 4.9,
    reviewCount: 218,
    tone: 'stone',
  },
  {
    id: 'p2',
    name: 'SonicPro X10',
    slug: 'sonicpro-x10',
    categoryLabel: 'Audio',
    description: "Réduction de bruit pure et 40 h d'autonomie pour rester concentré.",
    price: usd(159.2),
    compareAtPrice: usd(199),
    rating: 4.7,
    reviewCount: 412,
    tone: 'espresso',
  },
  {
    id: 'p3',
    name: 'VisionPad Pro',
    slug: 'visionpad-pro',
    categoryLabel: 'Tablettes',
    description: 'La toile ultime pour les créateurs, avec dalle 120 Hz ultra-réactive.',
    price: usd(799),
    rating: 4.8,
    reviewCount: 96,
    tone: 'slate',
  },
  {
    id: 'p4',
    name: 'Lumina 4K Projector',
    slug: 'lumina-4k-projector',
    categoryLabel: 'Home cinéma',
    description: 'Une expérience cinéma limpide dans votre salon, connectivité intelligente.',
    price: usd(1299),
    rating: 5,
    reviewCount: 54,
    tone: 'violet',
  },
  {
    id: 'p5',
    name: 'AeroBook Slim 14',
    slug: 'aerobook-slim-14',
    categoryLabel: 'Ordinateurs',
    description: 'Châssis 1,1 kg, autonomie de 18 h, pensé pour le travail nomade.',
    price: usd(1149),
    compareAtPrice: usd(1299),
    rating: 4.6,
    reviewCount: 133,
    tone: 'slate',
  },
  {
    id: 'p6',
    name: 'PulseBuds Air',
    slug: 'pulsebuds-air',
    categoryLabel: 'Audio',
    description: 'Écouteurs compacts, appairage instantané et boîtier de charge sans fil.',
    price: usd(89),
    rating: 4.4,
    reviewCount: 507,
    tone: 'espresso',
  },
]

/** Remise affichée sur la pastille promo — calculée, jamais saisie à la main. */
export function discountPercent(product: StorefrontProduct): number | undefined {
  if (!product.compareAtPrice) return undefined
  const from = product.compareAtPrice.amountCents
  return Math.round(((from - product.price.amountCents) / from) * 100)
}
