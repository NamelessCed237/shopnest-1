import type {
  AppError,
  CursorPage,
  DashboardRange,
  DashboardSummary,
  ListOrdersQuery,
  Order,
  PaymentMethod,
  RefundOrderInput,
  RevenuePoint,
  UpdateOrderStatusInput,
} from '@shopnest/contracts'
import { REFUNDABLE_STATUSES, canTransition } from '@shopnest/contracts'
import { normalizeForSearch } from '@shopnest/utils'
import { fakeProducts, fakeTenant } from './fixtures'
import { REVENUE_STATUSES, fakeCustomerName, fakeOrders } from './orders.fixtures'
import { FAKE_TODAY } from './clock'

const LATENCY_MS = 400
const CURRENCY = fakeTenant.defaultCurrency
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface ListOrdersFilters extends Partial<ListOrdersQuery> {
  paymentMethod?: PaymentMethod
  sortBy?: 'createdAt' | 'total'
  sortOrder?: 'asc' | 'desc'
}

/** Filtrage, tri et pagination faits ici, comme le ferait la base (doc/02 §2). */
export const fakeOrderEndpoints = {
  // Le second paramètre (signal) est accepté pour rester interchangeable avec le
  // vrai client, même si la version factice n'a rien à annuler.
  async list(query: ListOrdersFilters, _options?: { signal?: AbortSignal }): Promise<CursorPage<Order>> {
    await sleep(LATENCY_MS)

    const search = query.search ? normalizeForSearch(query.search) : undefined

    let items = fakeOrders.filter((order) => {
      if (query.status && order.status !== query.status) return false
      if (query.paymentMethod && order.payment?.method !== query.paymentMethod) return false
      if (search) {
        const haystack = normalizeForSearch(
          `${order.reference} ${fakeCustomerName(order.customerId)}`,
        )
        if (!haystack.includes(search)) return false
      }
      return true
    })

    const direction = query.sortOrder === 'asc' ? 1 : -1
    items = [...items].sort((a, b) =>
      query.sortBy === 'total'
        ? direction * (a.total.amountCents - b.total.amountCents)
        : direction * a.createdAt.localeCompare(b.createdAt),
    )

    const limit = query.limit ?? 20
    const start = query.cursor ? items.findIndex((o) => o.id === query.cursor) + 1 : 0
    const page = items.slice(start, start + limit)
    const nextCursor = start + limit < items.length ? page.at(-1)?.id : undefined

    return { items: page, ...(nextCursor ? { nextCursor } : {}), total: items.length }
  },

  async detail(orderId: string, _options?: { signal?: AbortSignal }): Promise<Order> {
    await sleep(LATENCY_MS / 2)

    const order = fakeOrders.find((item) => item.id === orderId)
    if (!order) {
      // 404 et non 403 : un 403 confirmerait l'existence de la commande (doc/08 §3).
      const error: AppError = {
        code: 'NOT_FOUND',
        message: `[fake-api] order ${orderId} not found`,
        userMessageKey: 'errors.notFound',
        traceId: crypto.randomUUID(),
      }
      throw error
    }
    return snapshot(order)
  },

  /**
   * doc §10.2 — changement de statut.
   *
   * La transition est validée contre `ORDER_TRANSITIONS` (@shopnest/contracts),
   * la même table que celle qu'appliquera le backend : l'écran ne peut pas
   * proposer une transition que le serveur refuserait, et l'inverse non plus.
   */
  async updateStatus(orderId: string, input: UpdateOrderStatusInput): Promise<Order> {
    await sleep(LATENCY_MS)

    const replayed = consumeIdempotencyKey(input.idempotencyKey, orderId)
    if (replayed) return replayed

    const order = mutableOrder(orderId)

    if (!canTransition(order.status, input.status)) {
      throw fail(
        'CONFLICT',
        'orders.errors.invalidTransition',
        `transition ${order.status} → ${input.status} refusée`,
      )
    }

    order.status = input.status
    if (input.status === 'paid' && order.payment) order.payment.status = 'settled'
    if (input.status === 'cancelled' && order.payment?.status === 'awaiting_confirmation') {
      order.payment.status = 'expired'
    }

    const result = snapshot(order)
    rememberIdempotencyKey(input.idempotencyKey, result)
    return result
  },

  /**
   * Remboursement total ou partiel.
   *
   * Le montant est plafonné au reste remboursable côté serveur, PAS seulement
   * dans le formulaire : un client modifié pourrait sinon rembourser plus que
   * le montant encaissé (doc/03 §6).
   */
  async refund(orderId: string, input: RefundOrderInput): Promise<Order> {
    await sleep(LATENCY_MS)

    const replayed = consumeIdempotencyKey(input.idempotencyKey, orderId)
    if (replayed) return replayed

    const order = mutableOrder(orderId)

    if (!REFUNDABLE_STATUSES.includes(order.status)) {
      throw fail(
        'CONFLICT',
        'orders.errors.notRefundable',
        `statut ${order.status} non remboursable`,
      )
    }

    const alreadyRefunded = order.refundedAmount?.amountCents ?? 0
    const remaining = order.total.amountCents - alreadyRefunded

    if (input.amountCents > remaining) {
      throw fail(
        'VALIDATION_FAILED',
        'orders.errors.refundTooLarge',
        `montant ${input.amountCents} > reste ${remaining}`,
        { amountCents: 'orders.errors.refundTooLarge' },
      )
    }

    const total = alreadyRefunded + input.amountCents
    order.refundedAmount = { amountCents: total, currency: order.total.currency }

    // Remboursement INTÉGRAL seulement : un remboursement partiel laisse la
    // commande dans son état (elle a bien été livrée), sinon l'historique
    // deviendrait faux.
    if (total >= order.total.amountCents) {
      order.status = 'refunded'
      if (order.payment) order.payment.status = 'refunded'
    }

    const result = snapshot(order)
    rememberIdempotencyKey(input.idempotencyKey, result)
    return result
  },
}

// --- Mutations : garde-fous partagés -----------------------------------------

/**
 * doc/03 §6 — IDEMPOTENCE.
 *
 * Un double-clic, un retry réseau ou un rejeu ne doivent produire qu'un seul
 * effet. On mémorise la clé et on renvoie le résultat initial, exactement comme
 * la table `webhook_events` du backend.
 */
const idempotencyStore = new Map<string, { orderId: string; result: Order }>()

function consumeIdempotencyKey(key: string, orderId: string): Order | undefined {
  const entry = idempotencyStore.get(key)
  if (!entry) return undefined
  if (entry.orderId !== orderId) {
    throw fail('CONFLICT', 'errors.generic', 'clé d’idempotence réutilisée sur une autre commande')
  }
  return entry.result
}

function rememberIdempotencyKey(key: string, result: Order): void {
  idempotencyStore.set(key, { orderId: result.id, result })
}

function mutableOrder(orderId: string): Order {
  const order = fakeOrders.find((item) => item.id === orderId)
  if (!order) throw fail('NOT_FOUND', 'errors.notFound', `order ${orderId} not found`)
  return order
}

/**
 * Renvoie une COPIE, jamais l'objet du magasin.
 *
 * Une vraie API renvoie un payload JSON neuf à chaque appel. Si la version
 * factice renvoie l'objet muté en place, React Query reçoit la même référence,
 * ne détecte aucun changement et l'écran affiche l'ancien statut alors que la
 * mutation a bien eu lieu — un décalage impossible à reproduire en production,
 * donc un faux bug qu'on chercherait longtemps.
 */
function snapshot(order: Order): Order {
  return {
    ...order,
    items: order.items.map((item) => ({ ...item })),
    ...(order.payment ? { payment: { ...order.payment } } : {}),
  }
}

function fail(
  code: AppError['code'],
  userMessageKey: string,
  message: string,
  fields?: Record<string, string>,
): AppError {
  return {
    code,
    message: `[fake-api] ${message}`,
    userMessageKey,
    ...(fields ? { fields } : {}),
    traceId: crypto.randomUUID(),
  }
}

const RANGE_DAYS: Record<DashboardRange, number> = { '7d': 7, '30d': 30, '90d': 90 }

export const fakeAnalyticsEndpoints = {
  async dashboard(range: DashboardRange): Promise<DashboardSummary> {
    await sleep(LATENCY_MS)

    const days = RANGE_DAYS[range]
    const current = ordersWithin(0, days)
    // Période précédente de MÊME durée : comparer 30 jours à 7 jours produirait
    // une variation absurde. Le delta est calculé ici, pas dans l'écran.
    const previous = ordersWithin(days, days * 2)

    const revenue = sumRevenue(current)
    const previousRevenue = sumRevenue(previous)

    const paidCurrent = current.filter((o) => REVENUE_STATUSES.includes(o.status))
    const paidPrevious = previous.filter((o) => REVENUE_STATUSES.includes(o.status))

    return {
      range,
      revenue: { amountCents: revenue, currency: CURRENCY },
      revenueDelta: { ratio: ratio(revenue, previousRevenue) },
      orderCount: current.length,
      orderCountDelta: { ratio: ratio(current.length, previous.length) },
      averageOrderValue: {
        amountCents: paidCurrent.length ? Math.round(revenue / paidCurrent.length) : 0,
        currency: CURRENCY,
      },
      averageOrderValueDelta: {
        ratio: ratio(
          paidCurrent.length ? revenue / paidCurrent.length : 0,
          paidPrevious.length ? previousRevenue / paidPrevious.length : 0,
        ),
      },
      lowStockCount: fakeProducts.filter(
        (p) => p.status !== 'archived' && p.stock > 0 && p.stock <= p.lowStockThreshold,
      ).length,
      outOfStockCount: fakeProducts.filter((p) => p.status !== 'archived' && p.stock === 0).length,
      series: buildSeries(days),
    }
  },

  async recentOrders(limit = 6): Promise<Order[]> {
    await sleep(LATENCY_MS / 2)
    return fakeOrders.slice(0, limit)
  },

  async lowStockProducts(limit = 5) {
    await sleep(LATENCY_MS / 2)
    return fakeProducts
      .filter((p) => p.status !== 'archived' && p.stock <= p.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, limit)
  },
}

// --- Helpers -----------------------------------------------------------------

function daysAgoBoundary(days: number): number {
  const date = new Date(FAKE_TODAY)
  date.setUTCDate(date.getUTCDate() - days)
  date.setUTCHours(0, 0, 0, 0)
  return date.getTime()
}

function ordersWithin(fromDaysAgo: number, toDaysAgo: number): Order[] {
  const start = daysAgoBoundary(toDaysAgo)
  const end = daysAgoBoundary(fromDaysAgo) + 86_400_000
  return fakeOrders.filter((order) => {
    const time = new Date(order.createdAt).getTime()
    return time >= start && time < end
  })
}

function sumRevenue(orders: Order[]): number {
  return orders
    .filter((order) => REVENUE_STATUSES.includes(order.status))
    .reduce((sum, order) => sum + order.total.amountCents, 0)
}

function ratio(current: number, previous: number): number | null {
  // Pas de division par zéro déguisée en « +100 % » : sans période de
  // comparaison, on n'affiche pas de variation du tout.
  if (previous === 0) return null
  return (current - previous) / previous
}

function buildSeries(days: number): RevenuePoint[] {
  // Index par jour en O(n) : un filter par jour serait O(jours × commandes).
  const byDay = new Map<string, { revenue: number; count: number }>()

  for (const order of fakeOrders) {
    const day = order.createdAt.slice(0, 10)
    const bucket = byDay.get(day) ?? { revenue: 0, count: 0 }
    bucket.count += 1
    if (REVENUE_STATUSES.includes(order.status)) bucket.revenue += order.total.amountCents
    byDay.set(day, bucket)
  }

  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(FAKE_TODAY)
    date.setUTCDate(date.getUTCDate() - (days - 1 - offset))
    date.setUTCHours(0, 0, 0, 0)
    const key = date.toISOString().slice(0, 10)
    const bucket = byDay.get(key)
    return {
      date: date.toISOString(),
      revenue: { amountCents: bucket?.revenue ?? 0, currency: CURRENCY },
      orderCount: bucket?.count ?? 0,
    }
  })
}
