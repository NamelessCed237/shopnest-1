import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { REVENUE_STATUSES, type ListTenantsQuery } from '@shopnest/contracts'
import { PrismaService } from '../../database/prisma.service'

export interface TenantStatsRow {
  tenantId: string
  productCount: number
  orderCount: number
  revenueCents: number
  lastOrderAt: Date | null
}

/**
 * doc/03 §2 — LE SEUL endroit où Prisma apparaît pour ce domaine.
 *
 * ⚠️ POURQUOI CE DÉPÔT INTERROGE LES BOUTIQUES UNE PAR UNE
 *
 * On écrirait spontanément une requête unique agrégeant toutes les boutiques.
 * Elle renverrait des ZÉROS : la RLS filtre chaque table scopée sur
 * `app.tenant_id`, et sans contexte tenant aucune ligne ne sort — pas d'erreur,
 * juste un tableau de bord vide (doc/03 §3.4).
 *
 * Trois issues, une seule tenable :
 *   · un rôle `BYPASSRLS` pour l'administration — impossible sur Supabase, où
 *     `postgres` n'est pas superuser et ne peut pas accorder cet attribut ;
 *   · une politique d'échappement déclenchée par un réglage de session — le
 *     rôle applicatif peut positionner n'importe quel `app.*`, donc n'importe
 *     quelle requête pourrait s'en servir : la deuxième barrière disparaîtrait ;
 *   · BOUCLER sur les boutiques en posant le contexte de chacune. Coûteux mais
 *     honnête : l'isolation reste absolue, sans rôle privilégié.
 *
 * C'est la troisième. Le coût est borné par la taille de page, et le jour où
 * cette boucle pèse, la réponse est de matérialiser ces compteurs — pas
 * d'affaiblir la RLS.
 */
@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants(query: ListTenantsQuery) {
    const rows = await this.prisma.tenant.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.planCode ? { planCode: query.planCode } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' as const } },
                { slug: { contains: query.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    })

    const hasNext = rows.length > query.limit
    return { rows: hasNext ? rows.slice(0, query.limit) : rows, hasNext }
  }

  findTenant(id: string) {
    return this.prisma.tenant.findUnique({ where: { id } })
  }

  /**
   * Compteurs d'une PAGE de boutiques.
   *
   * Une requête par boutique, exécutées en parallèle : la pagination borne
   * l'appel à `limit` requêtes, et le pool en absorbe une dizaine de front
   * (voir `connection_limit` dans .env).
   */
  async statsFor(tenantIds: string[]): Promise<Map<string, TenantStatsRow>> {
    const rows = await Promise.all(tenantIds.map((id) => this.statsForOne(id)))
    return new Map(rows.map((row) => [row.tenantId, row]))
  }

  private async statsForOne(tenantId: string): Promise<TenantStatsRow> {
    const [row] = await this.prisma.queryRawForTenant<
      Omit<TenantStatsRow, 'tenantId'>[]
    >(
      tenantId,
      Prisma.sql`
        SELECT (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL)::int AS "productCount",
               (SELECT COUNT(*) FROM orders)::int AS "orderCount",
               COALESCE((SELECT SUM(total_cents) FROM orders
                 WHERE status IN (${Prisma.join([...REVENUE_STATUSES])})), 0)::int AS "revenueCents",
               (SELECT MAX(created_at) FROM orders) AS "lastOrderAt"`,
    )

    // Aucun filtre `tenant_id` dans le SQL ci-dessus : la RLS s'en charge, et
    // c'est exactement ce que l'on veut vérifier ici — si elle tombait, ces
    // compteurs deviendraient ceux de la plateforme entière.
    return {
      tenantId,
      productCount: row?.productCount ?? 0,
      orderCount: row?.orderCount ?? 0,
      revenueCents: row?.revenueCents ?? 0,
      lastOrderAt: row?.lastOrderAt ?? null,
    }
  }

  updateTheme(id: string, theme: Prisma.InputJsonValue) {
    return this.prisma.tenant.update({ where: { id }, data: { themeJson: theme } })
  }

  updatePlan(id: string, planCode: string) {
    return this.prisma.tenant.update({ where: { id }, data: { planCode } })
  }

  /**
   * Chiffres de tête, toutes boutiques confondues.
   *
   * `tenants` n'a pas de colonne `tenant_id` : c'est un modèle GLOBAL, donc
   * hors RLS, et ces deux compteurs-là se lisent bien en une requête. Tout ce
   * qui touche aux produits, commandes ou commissions passe en revanche par la
   * boucle expliquée en tête de fichier.
   */
  async platformSummary() {
    const [tenantCount, activeTenantCount, tenants] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'active' } }),
      this.prisma.tenant.findMany({ select: { id: true, defaultCurrency: true } }),
    ])

    const perTenant = await Promise.all(
      tenants.map(async (tenant) => {
        const [row] = await this.prisma.queryRawForTenant<
          { productCount: number; orderCount: number; feesCents: number }[]
        >(
          tenant.id,
          Prisma.sql`
            SELECT (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL)::int AS "productCount",
                   (SELECT COUNT(*) FROM orders)::int AS "orderCount",
                   COALESCE((SELECT SUM(platform_fee_cents) FROM orders
                     WHERE status IN (${Prisma.join([...REVENUE_STATUSES])})), 0)::int AS "feesCents"`,
        )
        return { currency: tenant.defaultCurrency, ...row! }
      }),
    )

    return {
      tenantCount,
      activeTenantCount,
      productCount: perTenant.reduce((sum, row) => sum + row.productCount, 0),
      orderCount: perTenant.reduce((sum, row) => sum + row.orderCount, 0),
      // Les commissions restent ventilées PAR DEVISE : les additionner à
      // l'aveugle mélangerait des francs CFA et des euros pour produire un
      // nombre qui ne désigne rien. Le service décide quoi en faire.
      feesByCurrency: perTenant.reduce<Record<string, number>>((acc, row) => {
        acc[row.currency] = (acc[row.currency] ?? 0) + row.feesCents
        return acc
      }, {}),
    }
  }

  /** doc/03 §3.5 — tout accès inter-tenant laisse une trace. */
  audit(input: {
    actorId: string
    action: string
    targetTenantId: string
    before?: Prisma.InputJsonValue
    after?: Prisma.InputJsonValue
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        actorRole: 'super_admin',
        action: input.action,
        targetTenantId: input.targetTenantId,
        ...(input.before !== undefined ? { beforeJson: input.before } : {}),
        ...(input.after !== undefined ? { afterJson: input.after } : {}),
      },
    })
  }
}
