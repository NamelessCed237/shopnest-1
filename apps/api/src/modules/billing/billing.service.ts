import { Injectable } from '@nestjs/common'
import type { BillingSummary, PlanCode } from '@shopnest/contracts'
import { BillingRepository } from './billing.repository'

const MONTHS_OF_HISTORY = 12

/**
 * doc/03 §2 — logique métier. Ne connaît ni HTTP, ni Prisma.
 *
 * Les LIMITES du plan ne sont pas renvoyées : elles vivent dans `PLAN_LIMITS`,
 * que le client importe déjà (doc/02 §1.2). On envoie le code du plan et la
 * consommation ; le rapprochement se fait à l'affichage.
 */
@Injectable()
export class BillingService {
  constructor(private readonly repo: BillingRepository) {}

  async summary(): Promise<BillingSummary> {
    const start = startOfMonth(new Date(), MONTHS_OF_HISTORY - 1)

    const [{ planCode, currency }, usage, monthly, lifetimeFees] = await Promise.all([
      this.repo.plan(),
      this.repo.usage(),
      this.repo.monthly(start),
      this.repo.lifetimeFees(),
    ])

    const byMonth = new Map(monthly.map((row) => [monthKey(row.month), row]))

    /*
     * Les douze mois sont TOUS présents, même vides.
     *
     * Un mois sans vente ne produit pas de ligne en base ; sans ce remplissage,
     * l'histogramme collerait deux mois non consécutifs côte à côte et
     * laisserait croire à une activité continue.
     */
    const history = Array.from({ length: MONTHS_OF_HISTORY }, (_, index) => {
      const month = startOfMonth(new Date(), MONTHS_OF_HISTORY - 1 - index)
      const row = byMonth.get(monthKey(month))
      return {
        month: month.toISOString(),
        orderCount: row?.orderCount ?? 0,
        revenue: { amountCents: row?.revenueCents ?? 0, currency },
        fees: { amountCents: row?.feesCents ?? 0, currency },
      }
    })

    return {
      planCode: planCode as PlanCode,
      usage,
      currentMonthFees: history[history.length - 1]?.fees ?? { amountCents: 0, currency },
      previousMonthFees: history[history.length - 2]?.fees ?? { amountCents: 0, currency },
      lifetimeFees: { amountCents: lifetimeFees, currency },
      history,
    }
  }
}

/** Premier jour du mois, `monthsAgo` mois en arrière, en UTC. */
function startOfMonth(reference: Date, monthsAgo: number): Date {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - monthsAgo, 1, 0, 0, 0, 0),
  )
}

const monthKey = (date: Date): string => date.toISOString().slice(0, 7)
