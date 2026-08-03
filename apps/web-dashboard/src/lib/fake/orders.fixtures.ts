import type {
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@shopnest/contracts'
import { fakeProducts, fakeTenant } from './fixtures'
import { customerById, customerDisplayName, fakeCustomers } from './customers.fixtures'
import { FAKE_TODAY } from './clock'

/**
 * Commandes de démonstration, générées de façon DÉTERMINISTE.
 *
 * Pas de Math.random() : les captures d'écran, les tests et les comparaisons
 * avant/après doivent rester stables d'un rechargement à l'autre.
 */

const CURRENCY = fakeTenant.defaultCurrency

/** Générateur congruentiel — reproductible, suffisant pour des fixtures. */
function makeRng(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 2 ** 32
    return state / 2 ** 32
  }
}

/**
 * Les identités vivent dans `customers.fixtures.ts` : un seul jeu de noms pour
 * l'écran commandes et l'écran clients, sinon la même personne apparaîtrait
 * sous deux noms selon l'écran.
 */
const CUSTOMER_COUNT = fakeCustomers.length

/**
 * Répartition réaliste plutôt qu'uniforme : la majorité des commandes sont
 * livrées, les échecs de paiement sont rares mais présents. Une distribution
 * uniforme masquerait l'aspect réel des écrans (5 badges rouges sur 6 lignes).
 */
const STATUS_WEIGHTS: [OrderStatus, number][] = [
  ['delivered', 42],
  ['shipped', 16],
  ['preparing', 12],
  ['paid', 10],
  ['awaiting_payment', 6],
  ['pending', 4],
  ['cancelled', 5],
  ['refunded', 3],
  ['payment_failed', 2],
]

/** Mobile Money domine sur les marchés visés — la fixture doit le refléter. */
const METHOD_WEIGHTS: [PaymentMethod, number][] = [
  ['mtn_momo', 45],
  ['orange_money', 25],
  ['card', 28],
  ['bank_transfer', 2],
]

function weightedPick<T>(weights: [T, number][], roll: number): T {
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0)
  let threshold = roll * total
  for (const [value, weight] of weights) {
    threshold -= weight
    if (threshold <= 0) return value
  }
  return weights[0]![0]
}

/**
 * Le statut du paiement DÉCOULE du statut de la commande : une commande livrée
 * dont le paiement serait « en échec » n'existe pas. Une fixture incohérente
 * produirait des écrans impossibles à obtenir en production.
 */
function paymentStatusFor(status: OrderStatus): PaymentStatus {
  switch (status) {
    case 'payment_failed':
      return 'failed'
    case 'awaiting_payment':
      return 'awaiting_confirmation'
    case 'refunded':
      return 'refunded'
    case 'pending':
      return 'pending'
    default:
      return 'settled'
  }
}

/**
 * L'historique dépasse volontairement la fenêtre du tableau de bord (90 j).
 *
 * Avec un historique de 90 jours exactement, aucun client ne peut être
 * « dormant » — le segment existerait dans le code sans jamais s'afficher, et
 * le seuil de 90 jours ne serait jamais exercé. Le volume est augmenté en
 * proportion pour que la fenêtre récente reste aussi dense qu'avant.
 */
const ORDER_COUNT = 170
const DAYS_SPAN = 240

function dateDaysAgo(days: number, hourSeed: number): string {
  const date = new Date(FAKE_TODAY)
  date.setUTCDate(date.getUTCDate() - days)
  date.setUTCHours(8 + (hourSeed % 12), (hourSeed * 7) % 60, 0, 0)
  return date.toISOString()
}

function buildItems(rng: () => number, index: number): OrderItem[] {
  const itemCount = 1 + Math.floor(rng() * 3)
  return Array.from({ length: itemCount }, (_, i) => {
    const product = fakeProducts[(index * 3 + i * 5) % fakeProducts.length]!
    const quantity = 1 + Math.floor(rng() * 3)
    return {
      id: `item-${index}-${i}`,
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity,
      lineTotal: {
        amountCents: product.price.amountCents * quantity,
        currency: CURRENCY,
      },
    }
  })
}

export const fakeOrders: Order[] = Array.from({ length: ORDER_COUNT }, (_, index) => {
  const rng = makeRng(index * 7919 + 13)

  // Les commandes récentes sont plus denses : une distribution plate produirait
  // une courbe de chiffre d'affaires plate, donc un graphique qui ne dit rien.
  const daysAgo = Math.floor(DAYS_SPAN * rng() ** 1.6)

  const items = buildItems(rng, index)
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotal.amountCents, 0)
  const shippingCents = subtotalCents > 100_000 ? 0 : 2_500
  const discountCents = rng() < 0.18 ? Math.round(subtotalCents * 0.1) : 0
  const totalCents = subtotalCents + shippingCents - discountCents

  const status = weightedPick(STATUS_WEIGHTS, rng())
  const method = weightedPick(METHOD_WEIGHTS, rng())

  /*
   * Rattachement client en LOI DE PUISSANCE, pas en tourniquet.
   *
   * Une répartition uniforme donne le même nombre de commandes à tout le monde,
   * donc un seul segment peuplé et trois tuiles à zéro : l'écran ne démontre
   * plus rien. Une vraie boutique a une poignée de gros clients et une longue
   * traîne d'acheteurs à une commande — c'est ce que l'exposant reproduit.
   */
  const customerIndex = Math.min(
    Math.floor(CUSTOMER_COUNT * rng() ** 3.4),
    CUSTOMER_COUNT - 1,
  )

  return {
    id: `55555555-5555-4555-8555-${String(index).padStart(12, '0')}`,
    reference: `CMD-${String(2601 + index).padStart(5, '0')}`,
    customerId: `66666666-6666-4666-8666-${String(customerIndex).padStart(12, '0')}`,
    status,
    items,
    subtotal: { amountCents: subtotalCents, currency: CURRENCY },
    shipping: { amountCents: shippingCents, currency: CURRENCY },
    tax: { amountCents: 0, currency: CURRENCY },
    discount: { amountCents: discountCents, currency: CURRENCY },
    total: { amountCents: totalCents, currency: CURRENCY },
    platformFee: { amountCents: Math.round(totalCents * 0.015), currency: CURRENCY },
    payment: {
      id: `pay-${index}`,
      method,
      status: paymentStatusFor(status),
      amount: { amountCents: totalCents, currency: CURRENCY },
      provider: method === 'card' ? 'stripe' : method,
    },
    createdAt: dateDaysAgo(daysAgo, index),
  }
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

/** Nom d'affichage de l'acheteur — le vrai backend le joindra depuis `customers`. */
export const fakeCustomerName = (customerId: string | undefined): string => {
  if (!customerId) return 'Invité'
  const customer = customerById.get(customerId)
  return customer ? customerDisplayName(customer) : 'Client'
}

/** Une commande compte dans le chiffre d'affaires seulement si elle est encaissée. */
export const REVENUE_STATUSES: OrderStatus[] = ['paid', 'preparing', 'shipped', 'delivered']
