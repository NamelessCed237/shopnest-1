import type { Product, SessionUser, Tenant } from '@shopnest/contracts'

/**
 * Jeu de données de démonstration — développement uniquement.
 *
 * Il reprend volontairement les MÊMES comptes et produits que `prisma/seed.ts` :
 * le jour où la base est disponible, on bascule le drapeau VITE_FAKE_API et
 * l'application se comporte à l'identique. Aucun écran n'est à réécrire.
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

const iso = (day: number) => `2026-07-${String(day).padStart(2, '0')}T10:00:00.000Z`

export const fakeProducts: Product[] = [
  ['Casque Bluetooth ANC', 'casque-bluetooth-anc', 45_000, 'active', 24],
  ['Chargeur rapide 65 W', 'chargeur-rapide-65w', 18_500, 'active', 112],
  ['Clavier mécanique', 'clavier-mecanique', 62_000, 'active', 7],
  ['Souris ergonomique', 'souris-ergonomique', 22_000, 'draft', 0],
  ['Écran 27" 144 Hz', 'ecran-27-144hz', 210_000, 'active', 3],
  ['Webcam 1080p', 'webcam-1080p', 31_000, 'archived', 0],
].map(([name, slug, price, status, stock], index) => ({
  id: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`,
  slug: slug as string,
  name: name as string,
  description: '',
  price: { amountCents: price as number, currency: 'XAF' },
  status: status as Product['status'],
  stock: stock as number,
  lowStockThreshold: 5,
  imageUrls: [],
  categoryIds: [],
  variants: [],
  createdAt: iso(index + 1),
  updatedAt: iso(index + 1),
}))

export const fakeCategories = [
  { id: 'c1', name: 'Audio' },
  { id: 'c2', name: 'Accessoires' },
  { id: 'c3', name: 'Périphériques' },
  { id: 'c4', name: 'Écrans' },
]
