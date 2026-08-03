import type { Category, Product, SessionUser, Tenant } from '@shopnest/contracts'

/**
 * Jeu de données de démonstration — développement uniquement.
 *
 * Il reprend volontairement les MÊMES comptes que `prisma/seed.ts` : le jour où
 * la base est disponible, on bascule VITE_FAKE_API et l'application se comporte
 * à l'identique. Aucun écran n'est à réécrire.
 */

export const FAKE_PASSWORD = 'MotDePasseDev123'

export const fakeTenant: Tenant = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'alpha-electronics',
  name: 'Alpha Electronics',
  status: 'active',
  planCode: 'pro',
  countryCode: 'CM',
  defaultCurrency: 'XAF',
  theme: {},
  createdAt: '2026-01-15T09:00:00.000Z',
}

export interface FakeAccount {
  user: SessionUser
  password: string
}

export const fakeAccounts: FakeAccount[] = [
  {
    password: FAKE_PASSWORD,
    user: {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'admin@alpha.test',
      role: 'tenant_admin',
      audience: 'tenant',
      tenantId: fakeTenant.id,
    },
  },
  {
    password: FAKE_PASSWORD,
    user: {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'vendeur@alpha.test',
      role: 'tenant_staff',
      audience: 'tenant',
      tenantId: fakeTenant.id,
    },
  },
]

/**
 * Arborescence sur DEUX niveaux, comme l'autorise le contrat.
 *
 * Une liste plate ne permettrait pas d'exercer les règles qui comptent :
 * suppression d'un parent, changement de parent, refus de cycle.
 */
export const fakeCategories: Category[] = [
  { id: 'c1', slug: 'audio', name: 'Audio', description: '', position: 0 },
  { id: 'c2', slug: 'accessoires', name: 'Accessoires', description: '', position: 1 },
  { id: 'c3', slug: 'peripheriques', name: 'Périphériques', description: '', position: 2 },
  { id: 'c4', slug: 'ecrans', name: 'Écrans', description: '', position: 3 },
  { id: 'c5', slug: 'stockage', name: 'Stockage', description: '', position: 4 },
  // Sous-catégories
  { id: 'c6', slug: 'casques', name: 'Casques', description: '', parentId: 'c1', position: 0 },
  {
    id: 'c7',
    slug: 'enceintes',
    name: 'Enceintes',
    description: '',
    parentId: 'c1',
    position: 1,
  },
  { id: 'c8', slug: 'claviers', name: 'Claviers', description: '', parentId: 'c3', position: 0 },
  { id: 'c9', slug: 'souris', name: 'Souris', description: '', parentId: 'c3', position: 1 },
]

interface Seed {
  name: string
  slug: string
  priceCents: number
  status: Product['status']
  stock: number
  categoryId: string
}

/**
 * Volume délibérément supérieur à une page (20) : sans cela, la pagination et
 * la virtualisation ne seraient jamais exercées pendant le développement, et
 * les défauts n'apparaîtraient qu'en production sur un vrai catalogue.
 */
const SEEDS: Seed[] = [
  { name: 'Casque Bluetooth ANC', slug: 'casque-bluetooth-anc', priceCents: 45_000, status: 'active', stock: 24, categoryId: 'c1' },
  { name: 'Écouteurs sans fil', slug: 'ecouteurs-sans-fil', priceCents: 28_000, status: 'active', stock: 61, categoryId: 'c1' },
  { name: 'Enceinte portable', slug: 'enceinte-portable', priceCents: 39_500, status: 'active', stock: 4, categoryId: 'c1' },
  { name: 'Micro-casque gaming', slug: 'micro-casque-gaming', priceCents: 52_000, status: 'draft', stock: 0, categoryId: 'c1' },
  { name: 'Chargeur rapide 65 W', slug: 'chargeur-rapide-65w', priceCents: 18_500, status: 'active', stock: 112, categoryId: 'c2' },
  { name: 'Câble USB-C 2 m', slug: 'cable-usb-c-2m', priceCents: 5_500, status: 'active', stock: 340, categoryId: 'c2' },
  { name: 'Batterie externe 20 000 mAh', slug: 'batterie-externe-20000', priceCents: 32_000, status: 'active', stock: 18, categoryId: 'c2' },
  { name: 'Support téléphone voiture', slug: 'support-telephone-voiture', priceCents: 7_500, status: 'archived', stock: 0, categoryId: 'c2' },
  { name: 'Adaptateur secteur universel', slug: 'adaptateur-secteur', priceCents: 12_000, status: 'active', stock: 2, categoryId: 'c2' },
  { name: 'Clavier mécanique', slug: 'clavier-mecanique', priceCents: 62_000, status: 'active', stock: 7, categoryId: 'c3' },
  { name: 'Souris ergonomique', slug: 'souris-ergonomique', priceCents: 22_000, status: 'draft', stock: 0, categoryId: 'c3' },
  { name: 'Tapis de souris XL', slug: 'tapis-souris-xl', priceCents: 9_000, status: 'active', stock: 87, categoryId: 'c3' },
  { name: 'Hub USB 7 ports', slug: 'hub-usb-7-ports', priceCents: 26_500, status: 'active', stock: 33, categoryId: 'c3' },
  { name: 'Webcam 1080p', slug: 'webcam-1080p', priceCents: 31_000, status: 'archived', stock: 0, categoryId: 'c3' },
  { name: 'Tablette graphique', slug: 'tablette-graphique', priceCents: 78_000, status: 'active', stock: 5, categoryId: 'c3' },
  { name: 'Écran 27" 144 Hz', slug: 'ecran-27-144hz', priceCents: 210_000, status: 'active', stock: 3, categoryId: 'c4' },
  { name: 'Écran 24" bureautique', slug: 'ecran-24-bureautique', priceCents: 98_000, status: 'active', stock: 12, categoryId: 'c4' },
  { name: 'Écran ultra-large 34"', slug: 'ecran-ultralarge-34', priceCents: 385_000, status: 'draft', stock: 0, categoryId: 'c4' },
  { name: 'Bras support écran', slug: 'bras-support-ecran', priceCents: 44_000, status: 'active', stock: 21, categoryId: 'c4' },
  { name: 'SSD NVMe 1 To', slug: 'ssd-nvme-1to', priceCents: 68_000, status: 'active', stock: 44, categoryId: 'c5' },
  { name: 'SSD NVMe 2 To', slug: 'ssd-nvme-2to', priceCents: 125_000, status: 'active', stock: 9, categoryId: 'c5' },
  { name: 'Disque dur externe 4 To', slug: 'disque-externe-4to', priceCents: 89_000, status: 'active', stock: 1, categoryId: 'c5' },
  { name: 'Clé USB 128 Go', slug: 'cle-usb-128go', priceCents: 11_500, status: 'active', stock: 205, categoryId: 'c5' },
  { name: 'Carte microSD 256 Go', slug: 'carte-microsd-256go', priceCents: 19_000, status: 'archived', stock: 0, categoryId: 'c5' },
]

const isoAt = (index: number): string => {
  // Dates décroissantes déterministes : un Math.random() rendrait les captures
  // et les tests instables d'un rechargement à l'autre.
  const day = 28 - (index % 28)
  const month = index < 12 ? '07' : '06'
  return `2026-${month}-${String(day).padStart(2, '0')}T10:00:00.000Z`
}

export const fakeProducts: Product[] = SEEDS.map((seed, index) => ({
  id: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`,
  slug: seed.slug,
  name: seed.name,
  description: '',
  price: { amountCents: seed.priceCents, currency: fakeTenant.defaultCurrency },
  status: seed.status,
  stock: seed.stock,
  lowStockThreshold: 5,
  imageUrls: [],
  categoryIds: [seed.categoryId],
  variants: [],
  createdAt: isoAt(index),
  updatedAt: isoAt(index),
}))
