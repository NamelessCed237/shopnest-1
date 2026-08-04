import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { REVENUE_STATUSES, type LowStockProduct } from '@shopnest/contracts'
import { PrismaService } from '../../database/prisma.service'
import { TenantContext } from '../../tenancy/tenant-context'

export interface DailyPoint {
  day: Date
  revenueCents: number
  orderCount: number
}

export interface PeriodTotals {
  revenueCents: number
  /** TOUTES les commandes de la période, encaissées ou non. */
  orderCount: number
  /** Commandes encaissées seulement — dénominateur du panier moyen. */
  paidOrderCount: number
}

/**
 * doc/03 §2 — LE SEUL endroit où Prisma apparaît pour ce domaine.
 */
@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.withTenantIsolation()
  }

  /**
   * Série quotidienne, agrégée PAR POSTGRESQL.
   *
   * `$queryRaw` plutôt que Prisma : `groupBy` ne sait pas regrouper sur une
   * expression (`date_trunc`), il faudrait donc rapatrier chaque commande de la
   * période pour la ranger dans un seau côté Node. Sur 90 jours d'activité
   * réelle, cela veut dire transporter des milliers de lignes pour n'en
   * afficher que 90 points.
   *
   * ⚠️ Requête brute = l'extension d'isolation ne s'applique PAS. Le filtre
   * `tenant_id` est donc écrit explicitement, EN PLUS de la RLS qui protège
   * déjà : c'est exactement le cas de figure pour lequel la deuxième barrière
   * existe (doc/03 §3.4).
   */
  async dailySeries(from: Date, to: Date): Promise<DailyPoint[]> {
    const tenantId = TenantContext.getTenantIdOrThrow()

    return this.prisma.queryRawScoped<DailyPoint[]>(Prisma.sql`
      SELECT date_trunc('day', created_at) AS day,
             COALESCE(SUM(total_cents), 0)::int AS "revenueCents",
             COUNT(*)::int AS "orderCount"
      FROM orders
      WHERE tenant_id = ${tenantId}::uuid
        AND created_at >= ${from}
        AND created_at < ${to}
        AND status IN (${Prisma.join([...REVENUE_STATUSES])})
      GROUP BY 1
      ORDER BY 1`)
  }

  /**
   * Totaux d'une période. Deux compteurs de commandes, volontairement :
   * le tableau de bord annonce le NOMBRE total de commandes reçues, mais divise
   * le chiffre d'affaires par les seules commandes encaissées. Confondre les
   * deux ferait chuter le panier moyen à chaque commande annulée.
   */
  async totals(from: Date, to: Date): Promise<PeriodTotals> {
    const [all, paid] = await Promise.all([
      this.db.order.count({ where: { createdAt: { gte: from, lt: to } } }),
      this.db.order.aggregate({
        where: { createdAt: { gte: from, lt: to }, status: { in: [...REVENUE_STATUSES] } },
        _count: { _all: true },
        _sum: { totalCents: true },
      }),
    ])

    return {
      revenueCents: paid._sum.totalCents ?? 0,
      orderCount: all,
      paidOrderCount: paid._count._all,
    }
  }

  /**
   * Alertes de stock. Le seuil est par PRODUIT (`lowStockThreshold`) et non
   * global : un vendeur ne réapprovisionne pas un téléviseur et une coque de
   * téléphone au même rythme.
   */
  async stockAlerts(): Promise<{ lowStockCount: number; outOfStockCount: number }> {
    const tenantId = TenantContext.getTenantIdOrThrow()

    const [row] = await this.prisma.queryRawScoped<{ low: number; out: number }[]>(Prisma.sql`
      SELECT COUNT(*) FILTER (WHERE stock > 0 AND stock <= low_stock_threshold)::int AS low,
             COUNT(*) FILTER (WHERE stock = 0)::int AS out
      FROM products
      WHERE tenant_id = ${tenantId}::uuid
        AND deleted_at IS NULL
        AND status = 'active'`)

    return { lowStockCount: row?.low ?? 0, outOfStockCount: row?.out ?? 0 }
  }

  lowStockProducts(limit: number): Promise<LowStockProduct[]> {
    return this.prisma.queryRawScoped<LowStockProduct[]>(Prisma.sql`
      SELECT id, name, stock, low_stock_threshold AS "lowStockThreshold"
      FROM products
      WHERE tenant_id = ${TenantContext.getTenantIdOrThrow()}::uuid
        AND deleted_at IS NULL
        AND status = 'active'
        AND stock <= low_stock_threshold
      ORDER BY stock ASC, name ASC
      LIMIT ${limit}`)
  }

  async currency(): Promise<string> {
    const tenantId = TenantContext.getTenantIdOrThrow()
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { defaultCurrency: true },
    })
    if (!tenant) throw new Error(`tenant ${tenantId} introuvable`)
    return tenant.defaultCurrency
  }

  // --- Écran statistiques ---------------------------------------------------

  /**
   * Meilleures ventes, agrégées sur les LIGNES de commande.
   *
   * On somme `order_items.line_total_cents` et non le total des commandes : une
   * commande contenant trois produits différents ne doit pas créditer chacun
   * du montant complet. C'est l'erreur classique de ce genre de tableau, et
   * elle passe inaperçue parce que les chiffres restent plausibles.
   *
   * Le regroupement porte sur `product_id` avec le nom pris dans l'INSTANTANÉ
   * de la ligne : un produit renommé depuis reste identifiable tel qu'il a été
   * vendu.
   */
  topProducts(from: Date, to: Date, limit: number): Promise<TopProductRow[]> {
    return this.prisma.queryRawScoped<TopProductRow[]>(Prisma.sql`
      SELECT i.product_id AS "productId",
             MAX(i.product_name) AS name,
             SUM(i.quantity)::int AS "quantitySold",
             SUM(i.line_total_cents)::int AS "revenueCents"
      FROM order_items i
      JOIN orders o ON o.id = i.order_id
      WHERE i.tenant_id = ${TenantContext.getTenantIdOrThrow()}::uuid
        AND o.created_at >= ${from}
        AND o.created_at < ${to}
        AND o.status IN (${Prisma.join([...REVENUE_STATUSES])})
      GROUP BY i.product_id
      ORDER BY "revenueCents" DESC
      LIMIT ${limit}`)
  }

  /** Ventilation par moyen de paiement — quel canal encaisse réellement. */
  byPaymentMethod(from: Date, to: Date): Promise<PaymentMethodRow[]> {
    return this.prisma.queryRawScoped<PaymentMethodRow[]>(Prisma.sql`
      SELECT p.method,
             COUNT(DISTINCT o.id)::int AS "orderCount",
             SUM(o.total_cents)::int AS "revenueCents"
      FROM orders o
      JOIN payments p ON p.order_id = o.id
      WHERE o.tenant_id = ${TenantContext.getTenantIdOrThrow()}::uuid
        AND o.created_at >= ${from}
        AND o.created_at < ${to}
        AND o.status IN (${Prisma.join([...REVENUE_STATUSES])})
      GROUP BY p.method
      ORDER BY "revenueCents" DESC`)
  }

  /**
   * Ventilation par catégorie.
   *
   * Un produit peut appartenir à plusieurs catégories : la jointure duplique
   * alors sa ligne de commande, et la somme des catégories dépasse le chiffre
   * d'affaires réel. C'est assumé — la question posée est « combien pèse cette
   * catégorie », pas « comment répartir un euro entre deux catégories », qui
   * n'a pas de réponse objective.
   */
  byCategory(from: Date, to: Date, limit: number): Promise<CategoryRow[]> {
    return this.prisma.queryRawScoped<CategoryRow[]>(Prisma.sql`
      SELECT c.id AS "categoryId",
             c.name,
             SUM(i.quantity)::int AS "quantitySold",
             SUM(i.line_total_cents)::int AS "revenueCents"
      FROM order_items i
      JOIN orders o ON o.id = i.order_id
      JOIN "_CategoryToProduct" cp ON cp."B" = i.product_id
      JOIN categories c ON c.id = cp."A"
      WHERE i.tenant_id = ${TenantContext.getTenantIdOrThrow()}::uuid
        AND o.created_at >= ${from}
        AND o.created_at < ${to}
        AND o.status IN (${Prisma.join([...REVENUE_STATUSES])})
      GROUP BY c.id, c.name
      ORDER BY "revenueCents" DESC
      LIMIT ${limit}`)
  }

  /**
   * Nouveaux acheteurs contre acheteurs déjà venus, sur la période.
   *
   * « Nouveau » se juge sur la PREMIÈRE commande de l'acheteur, toutes périodes
   * confondues — pas sur sa première commande dans la fenêtre observée. Sans
   * cette précision, tout client redeviendrait « nouveau » chaque mois.
   */
  async customerMix(from: Date, to: Date): Promise<{ newCustomers: number; returning: number }> {
    const [row] = await this.prisma.queryRawScoped<{ nouveaux: number; connus: number }[]>(
      Prisma.sql`
      WITH historique AS (
        SELECT customer_id,
               MIN(created_at) AS first_at,
               -- A-t-il commandé DANS la fenêtre observée ?
               bool_or(created_at >= ${from} AND created_at < ${to}) AS actif
        FROM orders
        WHERE tenant_id = ${TenantContext.getTenantIdOrThrow()}::uuid
          AND customer_id IS NOT NULL
          AND status IN (${Prisma.join([...REVENUE_STATUSES])})
        GROUP BY customer_id
      )
      SELECT COUNT(*) FILTER (WHERE actif AND first_at >= ${from})::int AS nouveaux,
             -- « Revenu » = a acheté pendant la période ET avait déjà acheté
             -- avant. Compter tous les clients historiques, actifs ou non,
             -- ferait passer une boutique en perte de vitesse pour fidélisée.
             COUNT(*) FILTER (WHERE actif AND first_at < ${from})::int AS connus
      FROM historique`,
    )

    return { newCustomers: row?.nouveaux ?? 0, returning: row?.connus ?? 0 }
  }
}

export interface TopProductRow {
  productId: string
  name: string
  quantitySold: number
  revenueCents: number
}

export interface PaymentMethodRow {
  method: string
  orderCount: number
  revenueCents: number
}

export interface CategoryRow {
  categoryId: string
  name: string
  quantitySold: number
  revenueCents: number
}
