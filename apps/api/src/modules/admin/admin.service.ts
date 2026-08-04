import { Injectable } from '@nestjs/common'
import type {
  AdminTenant,
  ListTenantsQuery,
  PlanCode,
  PlatformSummary,
  TenantStatus,
  TenantTheme,
} from '@shopnest/contracts'
import { AppException } from '../../common/errors/app.exception'
import { AdminRepository, type TenantStatsRow } from './admin.repository'

/**
 * doc/03 §2 — logique métier du back-office plateforme.
 */
@Injectable()
export class AdminService {
  constructor(private readonly repo: AdminRepository) {}

  async listTenants(query: ListTenantsQuery) {
    const { rows, hasNext } = await this.repo.listTenants(query)
    const stats = await this.repo.statsFor(rows.map((row) => row.id))

    return {
      items: rows.map((row) => toAdminTenant(row, stats.get(row.id))),
      ...(hasNext ? { nextCursor: rows.at(-1)?.id } : {}),
    }
  }

  async tenant(id: string): Promise<AdminTenant> {
    const row = await this.repo.findTenant(id)
    if (!row) throw new AppException('NOT_FOUND', `tenant ${id} not found`)
    const stats = await this.repo.statsFor([id])
    return toAdminTenant(row, stats.get(id))
  }

  /**
   * Change l'identité visuelle d'une boutique.
   *
   * L'ancien thème est journalisé avec le nouveau : sans l'état AVANT, un audit
   * dit qu'une modification a eu lieu mais ne permet pas de revenir en arrière —
   * ce qui est précisément ce qu'on demande à un journal quand une boutique
   * signale que sa couleur a changé sans qu'elle l'ait demandé.
   */
  async updateTheme(id: string, actorId: string, theme: TenantTheme): Promise<AdminTenant> {
    const before = await this.tenant(id)

    await this.repo.updateTheme(id, theme)
    await this.repo.audit({
      actorId,
      action: 'tenant.theme.updated',
      targetTenantId: id,
      before: before.theme,
      after: theme,
    })

    return this.tenant(id)
  }

  async updatePlan(id: string, actorId: string, planCode: PlanCode): Promise<AdminTenant> {
    const before = await this.tenant(id)
    if (before.planCode === planCode) return before

    await this.repo.updatePlan(id, planCode)
    await this.repo.audit({
      actorId,
      action: 'tenant.plan.updated',
      targetTenantId: id,
      before: { planCode: before.planCode },
      after: { planCode },
    })

    return this.tenant(id)
  }

  async platformSummary(): Promise<PlatformSummary> {
    const summary = await this.repo.platformSummary()

    const currencies = Object.keys(summary.feesByCurrency)
    const total = Object.values(summary.feesByCurrency).reduce((sum, cents) => sum + cents, 0)

    return {
      tenantCount: summary.tenantCount,
      activeTenantCount: summary.activeTenantCount,
      productCount: summary.productCount,
      orderCount: summary.orderCount,
      platformFees: { amountCents: total, currency: currencies[0] ?? 'EUR' },
      // L'écran affiche un avertissement plutôt qu'un total silencieusement faux.
      mixedCurrencies: currencies.length > 1,
    }
  }
}

interface TenantRow {
  id: string
  slug: string
  name: string
  status: string
  planCode: string
  customDomain: string | null
  countryCode: string
  defaultCurrency: string
  themeJson: unknown
  createdAt: Date
}

function toAdminTenant(row: TenantRow, stats: TenantStatsRow | undefined): AdminTenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status as TenantStatus,
    planCode: row.planCode as PlanCode,
    ...(row.customDomain ? { customDomain: row.customDomain } : {}),
    countryCode: row.countryCode,
    defaultCurrency: row.defaultCurrency,
    // `defaultMode` est garanti par le schéma zod côté écriture ; une boutique
    // créée avant l'ajout du champ a un objet vide, d'où le repli explicite.
    theme: { defaultMode: 'system', ...((row.themeJson as TenantTheme | null) ?? {}) },
    createdAt: row.createdAt.toISOString(),
    productCount: stats?.productCount ?? 0,
    orderCount: stats?.orderCount ?? 0,
    revenue: { amountCents: stats?.revenueCents ?? 0, currency: row.defaultCurrency },
    ...(stats?.lastOrderAt ? { lastOrderAt: stats.lastOrderAt.toISOString() } : {}),
  }
}
