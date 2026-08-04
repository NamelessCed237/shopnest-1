import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { REVENUE_STATUSES } from '@shopnest/contracts'
import { PrismaService } from '../../database/prisma.service'
import { TenantContext } from '../../tenancy/tenant-context'

export interface MonthlyRow {
  month: Date
  orderCount: number
  revenueCents: number
  feesCents: number
}

/**
 * doc/03 §2 — LE SEUL endroit où Prisma apparaît pour ce domaine.
 */
@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.withTenantIsolation()
  }

  /** Consommation des quotas — comparée à PLAN_LIMITS côté client. */
  async usage(): Promise<{ products: number; staffUsers: number }> {
    const [products, staffUsers] = await Promise.all([
      this.db.product.count({ where: { deletedAt: null } }),
      this.db.tenantUser.count(),
    ])
    return { products, staffUsers }
  }

  /**
   * Relevé mensuel des commissions, agrégé par PostgreSQL.
   *
   * `date_trunc('month')` plutôt qu'un découpage côté Node : regrouper douze
   * mois de commandes en mémoire supposerait de toutes les rapatrier, alors
   * que la réponse tient en douze lignes.
   */
  monthly(from: Date): Promise<MonthlyRow[]> {
    return this.prisma.queryRawScoped<MonthlyRow[]>(Prisma.sql`
      SELECT date_trunc('month', created_at) AS month,
             COUNT(*)::int AS "orderCount",
             SUM(total_cents)::int AS "revenueCents",
             SUM(platform_fee_cents)::int AS "feesCents"
      FROM orders
      WHERE tenant_id = ${TenantContext.getTenantIdOrThrow()}::uuid
        AND created_at >= ${from}
        AND status IN (${Prisma.join([...REVENUE_STATUSES])})
      GROUP BY 1
      ORDER BY 1`)
  }

  /**
   * Cumul des commissions depuis l'ouverture de la boutique.
   *
   * Volontairement SANS borne de date : c'est le total facturé à ce jour, la
   * seule ligne que le vendeur puisse rapprocher de ses relevés.
   */
  async lifetimeFees(): Promise<number> {
    const result = await this.db.order.aggregate({
      where: { status: { in: [...REVENUE_STATUSES] } },
      _sum: { platformFeeCents: true },
    })
    return result._sum.platformFeeCents ?? 0
  }

  async plan(): Promise<{ planCode: string; currency: string }> {
    const tenantId = TenantContext.getTenantIdOrThrow()
    // `Tenant` est un modèle GLOBAL : client brut, pas d'injection de filtre.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planCode: true, defaultCurrency: true },
    })
    if (!tenant) throw new Error(`tenant ${tenantId} introuvable`)
    return { planCode: tenant.planCode, currency: tenant.defaultCurrency }
  }
}
