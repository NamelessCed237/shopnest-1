import type { Customer } from '@shopnest/contracts'
import { FAKE_TODAY } from './clock'

/**
 * Identités des acheteurs — source unique.
 *
 * `orders.fixtures.ts` s'y rattache par `customerId` : sans cela, le nom affiché
 * dans la liste des commandes et celui de la fiche client pourraient diverger,
 * ce qui est exactement le genre d'incohérence qu'une fausse API doit éviter.
 */

interface Identity {
  firstName: string
  lastName: string
  phone: string
  /** Ancienneté du compte, en jours avant la date figée des fixtures. */
  createdDaysAgo: number
}

const IDENTITIES: Identity[] = [
  { firstName: 'Aïcha', lastName: 'Ndiaye', phone: '+221771234501', createdDaysAgo: 320 },
  { firstName: 'Jean-Baptiste', lastName: 'Kouadio', phone: '+225070234502', createdDaysAgo: 275 },
  { firstName: 'Fatou', lastName: 'Diallo', phone: '+224620234503', createdDaysAgo: 210 },
  { firstName: 'Marc', lastName: 'Tchoumi', phone: '+237690234504', createdDaysAgo: 188 },
  { firstName: 'Sarah', lastName: 'Mballa', phone: '+237677234505', createdDaysAgo: 154 },
  { firstName: 'Ousmane', lastName: 'Traoré', phone: '+223760234506', createdDaysAgo: 132 },
  { firstName: 'Léa', lastName: 'Fongang', phone: '+237655234507', createdDaysAgo: 97 },
  { firstName: 'Ibrahim', lastName: 'Sow', phone: '+221781234508', createdDaysAgo: 64 },
  { firstName: 'Nadia', lastName: 'Bekele', phone: '+251911234509', createdDaysAgo: 41 },
  { firstName: 'Paul', lastName: 'Essomba', phone: '+237699234510', createdDaysAgo: 12 },
  { firstName: 'Mariam', lastName: 'Coulibaly', phone: '+226700234511', createdDaysAgo: 305 },
  { firstName: 'Kwame', lastName: 'Mensah', phone: '+233240234512', createdDaysAgo: 268 },
  { firstName: 'Chantal', lastName: 'Ngo Bell', phone: '+237694234513', createdDaysAgo: 244 },
  { firstName: 'Sekou', lastName: 'Camara', phone: '+224621234514', createdDaysAgo: 199 },
  { firstName: 'Awa', lastName: 'Sylla', phone: '+221776234515', createdDaysAgo: 176 },
  { firstName: 'Thierry', lastName: 'Mabiala', phone: '+242060234516', createdDaysAgo: 149 },
  { firstName: 'Grace', lastName: 'Ilunga', phone: '+243810234517', createdDaysAgo: 121 },
  { firstName: 'Yann', lastName: 'Abega', phone: '+237678234518', createdDaysAgo: 108 },
  { firstName: 'Zeinab', lastName: 'Haidara', phone: '+223770234519', createdDaysAgo: 86 },
  { firstName: 'Serge', lastName: 'Nkoulou', phone: '+237696234520', createdDaysAgo: 72 },
  { firstName: 'Amina', lastName: 'Bello', phone: '+234803234521', createdDaysAgo: 58 },
  { firstName: 'Didier', lastName: 'Kabongo', phone: '+243990234522', createdDaysAgo: 35 },
  { firstName: 'Hawa', lastName: 'Konate', phone: '+225050234523', createdDaysAgo: 21 },
  { firstName: 'Emmanuel', lastName: 'Oyono', phone: '+241060234524', createdDaysAgo: 5 },
]

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '')

function createdAt(daysAgo: number): string {
  const date = new Date(FAKE_TODAY)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString()
}

export const fakeCustomers: Customer[] = IDENTITIES.map((identity, index) => ({
  // Même schéma d'identifiant que `order.customerId` : c'est la jointure.
  id: `66666666-6666-4666-8666-${String(index).padStart(12, '0')}`,
  email: `${slug(identity.firstName)}.${slug(identity.lastName)}@exemple.test`,
  firstName: identity.firstName,
  lastName: identity.lastName,
  phone: identity.phone,
  createdAt: createdAt(identity.createdDaysAgo),
}))

export const customerById = new Map(fakeCustomers.map((customer) => [customer.id, customer]))

export function customerDisplayName(customer: Customer): string {
  const full = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
  return full || customer.email
}
