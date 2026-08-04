import { Injectable } from '@nestjs/common'
import {
  computeSegment,
  type CustomerSegment,
  type CustomerSummary,
  type ListCustomersQuery,
} from '@shopnest/contracts'
import { normalizeForSearch } from '@shopnest/utils'
import { AppException } from '../../common/errors/app.exception'
import { CustomersRepository, type CustomerStats } from './customers.repository'

interface CustomerRow {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  createdAt: Date
}

/**
 * doc/03 §2 — logique métier. Ne connaît ni HTTP, ni Prisma.
 *
 * Le SEGMENT est calculé côté serveur avec `computeSegment`
 * (@shopnest/contracts) : le web, le mobile et un futur export CSV doivent
 * classer le même acheteur de la même façon. Le recalculer dans chaque client
 * garantirait l'inverse.
 */
@Injectable()
export class CustomersService {
  constructor(private readonly repo: CustomersRepository) {}

  /**
   * Pagination en MÉMOIRE, contrairement aux produits et aux commandes.
   *
   * Le tri porte sur des valeurs agrégées — total dépensé, nombre de commandes,
   * date de dernière commande — que SQL ne peut pas ordonner sans joindre puis
   * regrouper l'intégralité des commandes du vendeur à chaque page. Charger les
   * clients (quelques milliers au plus) et leurs agrégats en deux requêtes
   * revient moins cher, et surtout reste constant quel que soit le numéro de
   * page.
   *
   * Le jour où un vendeur dépasse la dizaine de milliers de clients, la
   * réponse n'est pas de paginer en SQL mais de matérialiser ces agrégats —
   * c'est-à-dire de changer le schéma, pas cette fonction.
   */
  async list(query: ListCustomersQuery): Promise<{
    items: CustomerSummary[]
    nextCursor?: string
    total: number
  }> {
    const all = await this.summaries()

    const needle = query.search ? normalizeForSearch(query.search) : undefined
    const filtered = all.filter((customer) => {
      if (query.segment && customer.segment !== query.segment) return false
      if (!needle) return true
      const haystack = normalizeForSearch(
        `${customer.firstName ?? ''} ${customer.lastName ?? ''} ${customer.email} ${customer.phone ?? ''}`,
      )
      return haystack.includes(needle)
    })

    const direction = query.sortOrder === 'asc' ? 1 : -1
    const sorted = [...filtered].sort((a, b) => direction * compare(query.sortBy, a, b))

    const start = query.cursor ? sorted.findIndex((c) => c.id === query.cursor) + 1 : 0
    const page = sorted.slice(start, start + query.limit)
    const hasNext = start + query.limit < sorted.length

    return {
      items: page,
      ...(hasNext ? { nextCursor: page.at(-1)?.id } : {}),
      total: sorted.length,
    }
  }

  async detail(id: string): Promise<CustomerSummary> {
    const row = await this.repo.findById(id)
    // 404 et non 403 pour une fiche d'un autre tenant (doc/08 §3).
    if (!row) throw new AppException('NOT_FOUND', `customer ${id} not found`)

    const [stats, currency] = await Promise.all([this.repo.statsByCustomer(), this.repo.currency()])
    return toSummary(row, stats.get(id), currency)
  }

  /** Répartition par segment — alimente les tuiles au-dessus du tableau. */
  async segmentCounts(): Promise<Record<CustomerSegment, number>> {
    const counts: Record<CustomerSegment, number> = {
      new: 0,
      returning: 0,
      loyal: 0,
      dormant: 0,
    }
    for (const customer of await this.summaries()) counts[customer.segment] += 1
    return counts
  }

  private async summaries(): Promise<CustomerSummary[]> {
    const [rows, stats, currency] = await Promise.all([
      this.repo.findAll(),
      this.repo.statsByCustomer(),
      this.repo.currency(),
    ])
    return rows.map((row) => toSummary(row, stats.get(row.id), currency))
  }
}

function toSummary(
  row: CustomerRow,
  stats: CustomerStats | undefined,
  currency: string,
): CustomerSummary {
  const orderCount = stats?.orderCount ?? 0
  const totalSpentCents = stats?.totalSpentCents ?? 0
  const lastOrderAt = stats?.lastOrderAt?.toISOString()

  return {
    id: row.id,
    email: row.email,
    ...(row.firstName ? { firstName: row.firstName } : {}),
    ...(row.lastName ? { lastName: row.lastName } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    createdAt: row.createdAt.toISOString(),
    orderCount,
    totalSpent: { amountCents: totalSpentCents, currency },
    averageOrderValue: {
      amountCents: orderCount > 0 ? Math.round(totalSpentCents / orderCount) : 0,
      currency,
    },
    ...(stats?.firstOrderAt ? { firstOrderAt: stats.firstOrderAt.toISOString() } : {}),
    ...(lastOrderAt ? { lastOrderAt } : {}),
    segment: computeSegment({
      orderCount,
      ...(lastOrderAt ? { lastOrderAt } : {}),
      now: Date.now(),
    }),
  }
}

function compare(
  key: ListCustomersQuery['sortBy'],
  a: CustomerSummary,
  b: CustomerSummary,
): number {
  switch (key) {
    case 'totalSpent':
      return a.totalSpent.amountCents - b.totalSpent.amountCents
    case 'orderCount':
      return a.orderCount - b.orderCount
    case 'name':
      return displayName(a).localeCompare(displayName(b), 'fr')
    case 'lastOrderAt':
    default:
      // Un client sans commande n'est pas « le plus ancien » : il n'a pas de
      // date du tout. On le renvoie en fin de tri décroissant plutôt que de lui
      // prêter une date de 1970, qui le placerait juste avant les autres.
      return (a.lastOrderAt ? Date.parse(a.lastOrderAt) : 0) -
        (b.lastOrderAt ? Date.parse(b.lastOrderAt) : 0)
  }
}

const displayName = (customer: CustomerSummary): string =>
  `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() || customer.email
