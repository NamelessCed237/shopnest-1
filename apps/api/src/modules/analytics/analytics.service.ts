import { Injectable } from '@nestjs/common'
import type {
  DashboardRange,
  DashboardSummary,
  RevenuePoint,
  StatisticsSummary,
} from '@shopnest/contracts'
import { AnalyticsRepository } from './analytics.repository'
import { OrdersService } from '../orders/orders.service'

const RANGE_DAYS: Record<DashboardRange, number> = { '7d': 7, '30d': 30, '90d': 90 }

/**
 * Un classement lisible, pas un export.
 *
 * Dix lignes tiennent à l'écran sans défilement et suffisent à voir où se
 * concentre le chiffre d'affaires. Au-delà, on ne lit plus un classement, on
 * consulte un tableau — ce qui relèverait d'un export, pas de cet écran.
 */
const TOP_LIMIT = 10

const DAY_MS = 86_400_000

/**
 * doc/03 §2 — logique métier. Ne connaît ni HTTP, ni Prisma.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository,
    private readonly orders: OrdersService,
  ) {}

  async dashboard(range: DashboardRange): Promise<DashboardSummary> {
    const days = RANGE_DAYS[range]

    // Bornes alignées sur le JOUR, pas sur l'heure courante. Sinon la période
    // glisse à chaque requête et deux rafraîchissements successifs affichent
    // deux chiffres différents pour « les 30 derniers jours ».
    const end = startOfNextDay(new Date())
    const start = new Date(end.getTime() - days * DAY_MS)
    // Période précédente de MÊME durée : comparer 30 jours à 7 produirait une
    // variation qui ne veut rien dire.
    const previousStart = new Date(start.getTime() - days * DAY_MS)

    const [current, previous, series, alerts, currency] = await Promise.all([
      this.repo.totals(start, end),
      this.repo.totals(previousStart, start),
      this.repo.dailySeries(start, end),
      this.repo.stockAlerts(),
      this.repo.currency(),
    ])

    const averageNow = current.paidOrderCount ? current.revenueCents / current.paidOrderCount : 0
    const averageBefore = previous.paidOrderCount
      ? previous.revenueCents / previous.paidOrderCount
      : 0

    return {
      range,
      revenue: { amountCents: current.revenueCents, currency },
      revenueDelta: { ratio: ratio(current.revenueCents, previous.revenueCents) },
      orderCount: current.orderCount,
      orderCountDelta: { ratio: ratio(current.orderCount, previous.orderCount) },
      averageOrderValue: { amountCents: Math.round(averageNow), currency },
      averageOrderValueDelta: { ratio: ratio(averageNow, averageBefore) },
      lowStockCount: alerts.lowStockCount,
      outOfStockCount: alerts.outOfStockCount,
      series: fillGaps(series, start, days, currency),
    }
  }

  /**
   * Écran statistiques : les ventilations, sur la même fenêtre que le tableau
   * de bord pour que les deux écrans restent comparables.
   */
  async statistics(range: DashboardRange): Promise<StatisticsSummary> {
    const days = RANGE_DAYS[range]
    const end = startOfNextDay(new Date())
    const start = new Date(end.getTime() - days * DAY_MS)

    const [topProducts, byPaymentMethod, byCategory, mix, currency] = await Promise.all([
      this.repo.topProducts(start, end, TOP_LIMIT),
      this.repo.byPaymentMethod(start, end),
      this.repo.byCategory(start, end, TOP_LIMIT),
      this.repo.customerMix(start, end),
      this.repo.currency(),
    ])

    return {
      range,
      topProducts: topProducts.map((row) => ({
        productId: row.productId,
        name: row.name,
        quantitySold: row.quantitySold,
        revenue: { amountCents: row.revenueCents, currency },
      })),
      byPaymentMethod: byPaymentMethod.map((row) => ({
        method: row.method,
        orderCount: row.orderCount,
        revenue: { amountCents: row.revenueCents, currency },
      })),
      byCategory: byCategory.map((row) => ({
        categoryId: row.categoryId,
        name: row.name,
        quantitySold: row.quantitySold,
        revenue: { amountCents: row.revenueCents, currency },
      })),
      newCustomers: mix.newCustomers,
      returningCustomers: mix.returning,
    }
  }

  /**
   * Dernières commandes du tableau de bord. Déléguées au module commandes : la
   * tuile doit montrer exactement ce que montrerait l'écran dédié, mapper et
   * tri compris.
   */
  async recentOrders(limit: number) {
    const page = await this.orders.list({ limit })
    return page.items
  }

  lowStockProducts(limit: number) {
    return this.repo.lowStockProducts(limit)
  }
}

/**
 * Une journée sans vente n'existe pas en base : `GROUP BY` ne produit pas de
 * ligne pour elle. Sans ce remplissage, le graphique relierait directement les
 * deux jours voisins et dessinerait une activité continue là où il n'y en a
 * pas eu — un mensonge visuel.
 */
function fillGaps(
  points: { day: Date; revenueCents: number; orderCount: number }[],
  start: Date,
  days: number,
  currency: string,
): RevenuePoint[] {
  const byDay = new Map(points.map((point) => [point.day.toISOString().slice(0, 10), point]))

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS)
    const found = byDay.get(date.toISOString().slice(0, 10))
    return {
      date: date.toISOString(),
      revenue: { amountCents: found?.revenueCents ?? 0, currency },
      orderCount: found?.orderCount ?? 0,
    }
  })
}

/** `null` quand la période précédente est vide : « +∞ % » n'informe personne. */
function ratio(now: number, before: number): number | null {
  if (before === 0) return null
  return (now - before) / before
}

function startOfNextDay(reference: Date): Date {
  const date = new Date(reference)
  date.setUTCHours(0, 0, 0, 0)
  return new Date(date.getTime() + DAY_MS)
}
