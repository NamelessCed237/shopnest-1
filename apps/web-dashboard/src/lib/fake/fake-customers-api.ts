import type {
  AppError,
  CursorPage,
  CustomerSegment,
  CustomerSummary,
  ListCustomersQuery,
  Order,
} from '@shopnest/contracts'
import { computeSegment } from '@shopnest/contracts'
import { normalizeForSearch } from '@shopnest/utils'
import { FAKE_TODAY } from './clock'
import { customerDisplayName, fakeCustomers } from './customers.fixtures'
import { REVENUE_STATUSES, fakeOrders } from './orders.fixtures'
import { fakeTenant } from './fixtures'

const LATENCY_MS = 400
const CURRENCY = fakeTenant.defaultCurrency
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface ListCustomersFilters extends Partial<ListCustomersQuery> {}

interface Aggregate {
  orderCount: number
  totalSpentCents: number
  paidOrderCount: number
  firstOrderAt?: string
  lastOrderAt?: string
}

/**
 * Agrégation en UN SEUL passage sur les commandes — doc/02 §2.3.
 *
 * La version naïve (pour chaque client, filtrer les commandes) serait en
 * O(clients × commandes) : imperceptible sur 10 clients de démonstration,
 * catastrophique sur un vrai catalogue. Le vrai backend fera un GROUP BY,
 * qui a exactement la même complexité.
 */
function aggregateByCustomer(orders: readonly Order[]): Map<string, Aggregate> {
  const byCustomer = new Map<string, Aggregate>()

  for (const order of orders) {
    if (!order.customerId) continue

    const current = byCustomer.get(order.customerId) ?? {
      orderCount: 0,
      totalSpentCents: 0,
      paidOrderCount: 0,
    }

    current.orderCount += 1

    // Le « total dépensé » ne compte que les commandes ENCAISSÉES : inclure une
    // commande annulée gonflerait la valeur client et fausserait la segmentation.
    if (REVENUE_STATUSES.includes(order.status)) {
      current.totalSpentCents += order.total.amountCents
      current.paidOrderCount += 1
    }

    if (!current.firstOrderAt || order.createdAt < current.firstOrderAt) {
      current.firstOrderAt = order.createdAt
    }
    if (!current.lastOrderAt || order.createdAt > current.lastOrderAt) {
      current.lastOrderAt = order.createdAt
    }

    byCustomer.set(order.customerId, current)
  }

  return byCustomer
}

function buildSummaries(): CustomerSummary[] {
  const aggregates = aggregateByCustomer(fakeOrders)
  const now = FAKE_TODAY.getTime()

  return fakeCustomers.map((customer) => {
    const aggregate = aggregates.get(customer.id) ?? {
      orderCount: 0,
      totalSpentCents: 0,
      paidOrderCount: 0,
    }

    return {
      ...customer,
      /*
       * Un compte ne peut pas avoir été créé APRÈS sa première commande.
       * L'ancienneté des identités et les dates de commandes sont générées
       * indépendamment ; sans ce recalage, la fiche affiche « client depuis
       * mai 2026 » au-dessus de « première commande décembre 2025 ».
       */
      createdAt:
        aggregate.firstOrderAt && aggregate.firstOrderAt < customer.createdAt
          ? aggregate.firstOrderAt
          : customer.createdAt,
      orderCount: aggregate.orderCount,
      totalSpent: { amountCents: aggregate.totalSpentCents, currency: CURRENCY },
      averageOrderValue: {
        amountCents: aggregate.paidOrderCount
          ? Math.round(aggregate.totalSpentCents / aggregate.paidOrderCount)
          : 0,
        currency: CURRENCY,
      },
      ...(aggregate.firstOrderAt ? { firstOrderAt: aggregate.firstOrderAt } : {}),
      ...(aggregate.lastOrderAt ? { lastOrderAt: aggregate.lastOrderAt } : {}),
      // Règle partagée avec le backend (@shopnest/contracts) : deux clients ne
      // doivent jamais classer le même acheteur différemment.
      segment: computeSegment({
        orderCount: aggregate.orderCount,
        ...(aggregate.lastOrderAt ? { lastOrderAt: aggregate.lastOrderAt } : {}),
        now,
      }),
    }
  })
}

export const fakeCustomerEndpoints = {
  async list(
    query: ListCustomersFilters,
    _options?: { signal?: AbortSignal },
  ): Promise<CursorPage<CustomerSummary>> {
    await sleep(LATENCY_MS)

    const search = query.search ? normalizeForSearch(query.search) : undefined

    let items = buildSummaries().filter((customer) => {
      if (query.segment && customer.segment !== query.segment) return false
      if (search) {
        const haystack = normalizeForSearch(
          `${customerDisplayName(customer)} ${customer.email} ${customer.phone ?? ''}`,
        )
        if (!haystack.includes(search)) return false
      }
      return true
    })

    const direction = query.sortOrder === 'asc' ? 1 : -1
    items = [...items].sort((a, b) => direction * compare(query.sortBy ?? 'lastOrderAt', a, b))

    const limit = query.limit ?? 20
    const start = query.cursor ? items.findIndex((c) => c.id === query.cursor) + 1 : 0
    const page = items.slice(start, start + limit)
    const nextCursor = start + limit < items.length ? page.at(-1)?.id : undefined

    return { items: page, ...(nextCursor ? { nextCursor } : {}), total: items.length }
  },

  async detail(customerId: string, _options?: { signal?: AbortSignal }): Promise<CustomerSummary> {
    await sleep(LATENCY_MS / 2)

    const customer = buildSummaries().find((item) => item.id === customerId)
    if (!customer) {
      // Même code que le backend pour une ressource d'un autre tenant : 404 et
      // non 403, sinon la réponse confirmerait l'existence de la fiche (doc/08 §3).
      const error: AppError = {
        code: 'NOT_FOUND',
        message: `[fake-api] customer ${customerId} not found`,
        userMessageKey: 'errors.notFound',
        traceId: crypto.randomUUID(),
      }
      throw error
    }
    return customer
  },

  /** Historique d'achats — doc §10.3 du cahier des charges. */
  async orders(
    customerId: string,
    query: { cursor?: string; limit?: number } = {},
    _options?: { signal?: AbortSignal },
  ): Promise<CursorPage<Order>> {
    await sleep(LATENCY_MS)

    const items = fakeOrders.filter((order) => order.customerId === customerId)
    const limit = query.limit ?? 10
    const start = query.cursor ? items.findIndex((o) => o.id === query.cursor) + 1 : 0
    const page = items.slice(start, start + limit)
    const nextCursor = start + limit < items.length ? page.at(-1)?.id : undefined

    return { items: page, ...(nextCursor ? { nextCursor } : {}), total: items.length }
  },

  /** Répartition par segment — alimente les tuiles au-dessus du tableau. */
  async segmentCounts(): Promise<Record<CustomerSegment, number>> {
    await sleep(LATENCY_MS / 2)
    const counts: Record<CustomerSegment, number> = {
      new: 0,
      returning: 0,
      loyal: 0,
      dormant: 0,
    }
    for (const customer of buildSummaries()) counts[customer.segment] += 1
    return counts
  },
}

function compare(
  key: NonNullable<ListCustomersQuery['sortBy']>,
  a: CustomerSummary,
  b: CustomerSummary,
): number {
  switch (key) {
    case 'name':
      return customerDisplayName(a).localeCompare(customerDisplayName(b), 'fr')
    case 'totalSpent':
      return a.totalSpent.amountCents - b.totalSpent.amountCents
    case 'orderCount':
      return a.orderCount - b.orderCount
    case 'lastOrderAt':
      // Un client sans commande n'a pas de date : il part en fin de tri
      // décroissant plutôt que d'être traité comme « très ancien ».
      return (a.lastOrderAt ?? '').localeCompare(b.lastOrderAt ?? '')
  }
}
