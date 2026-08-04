import { Injectable } from '@nestjs/common'
import { REVENUE_STATUSES } from '@shopnest/contracts'
import { PrismaService } from '../../database/prisma.service'
import { TenantContext } from '../../tenancy/tenant-context'

/** Agrégats d'achat d'un client, tels que la base sait les produire. */
export interface CustomerStats {
  customerId: string
  orderCount: number
  totalSpentCents: number
  firstOrderAt: Date | null
  lastOrderAt: Date | null
}

/**
 * doc/03 §2 — LE SEUL endroit où Prisma apparaît pour ce domaine.
 */
@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.withTenantIsolation()
  }

  findAll() {
    return this.db.customer.findMany({ orderBy: { createdAt: 'desc' } })
  }

  findById(id: string) {
    return this.db.customer.findFirst({ where: { id } })
  }

  /**
   * Agrégats d'achat de TOUS les clients, en UNE requête.
   *
   * `groupBy` plutôt qu'une boucle de comptages : la fiche client comme le
   * tableau ont besoin des mêmes chiffres, et une requête par client ferait un
   * N+1 dès la deuxième page (doc/02 §2.3).
   *
   * Seuls les statuts de `REVENUE_STATUSES` sont comptés : une commande annulée
   * ne fait pas de son acheteur un client fidèle, et gonflerait un total dépensé
   * qui n'a jamais été encaissé.
   */
  async statsByCustomer(): Promise<Map<string, CustomerStats>> {
    const rows = await this.db.order.groupBy({
      by: ['customerId'],
      where: { status: { in: [...REVENUE_STATUSES] }, customerId: { not: null } },
      _count: { _all: true },
      _sum: { totalCents: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    })

    const stats = new Map<string, CustomerStats>()
    for (const row of rows) {
      if (!row.customerId) continue
      stats.set(row.customerId, {
        customerId: row.customerId,
        orderCount: row._count._all,
        totalSpentCents: row._sum.totalCents ?? 0,
        firstOrderAt: row._min.createdAt,
        lastOrderAt: row._max.createdAt,
      })
    }
    return stats
  }

  /**
   * Devise du vendeur.
   *
   * Une somme agrégée n'en porte aucune : `SUM(total_cents)` est un entier. On
   * la lit sur le tenant plutôt que sur une commande au hasard — une boutique
   * sans commande doit quand même afficher « 0 FCFA » et non « 0 » tout court.
   */
  async currency(): Promise<string> {
    const tenantId = TenantContext.getTenantIdOrThrow()
    // `Tenant` est un modèle GLOBAL : client brut, pas d'injection de filtre.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { defaultCurrency: true },
    })
    if (!tenant) throw new Error(`tenant ${tenantId} introuvable`)
    return tenant.defaultCurrency
  }
}
