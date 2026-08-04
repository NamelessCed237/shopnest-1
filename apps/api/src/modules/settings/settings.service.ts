import { Injectable } from '@nestjs/common'
import {
  PLAN_LIMITS,
  type PlanCode,
  type TeamMember,
  type TenantSettings,
  type TenantStatus,
  type UpdateTenantSettingsInput,
  type UserRole,
} from '@shopnest/contracts'
import { AppException } from '../../common/errors/app.exception'
import { PrismaService } from '../../database/prisma.service'
import { TenantContext } from '../../tenancy/tenant-context'

/**
 * doc/03 §2 — profil de la boutique et équipe.
 *
 * `Tenant` est un modèle GLOBAL (absent de TENANT_SCOPED_MODELS) : il est lu et
 * écrit avec le client brut, TOUJOURS filtré sur l'identifiant du contexte.
 * C'est le seul module qui touche à cette table depuis l'espace vendeur, et
 * chaque requête y est explicitement bornée.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(): Promise<TenantSettings> {
    const tenantId = TenantContext.getTenantIdOrThrow()
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) throw new AppException('NOT_FOUND', `tenant ${tenantId} not found`)
    return toSettings(tenant)
  }

  async update(input: UpdateTenantSettingsInput): Promise<TenantSettings> {
    const tenantId = TenantContext.getTenantIdOrThrow()
    const current = await this.profile()

    if (input.customDomain !== undefined) {
      await this.assertCustomDomainAllowed(current.planCode, input.customDomain, tenantId)
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        // `null` retire le domaine, `undefined` ne le touche pas — la
        // distinction vient du contrat et doit survivre jusqu'ici.
        ...(input.customDomain !== undefined ? { customDomain: input.customDomain } : {}),
      },
    })

    return toSettings(tenant)
  }

  /** Équipe de la boutique — `TenantUser` est scopé, l'extension filtre. */
  async team(): Promise<TeamMember[]> {
    const rows = await this.prisma.withTenantIsolation().tenantUser.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, role: true, createdAt: true },
    })

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role as UserRole,
      createdAt: row.createdAt.toISOString(),
    }))
  }

  private async assertCustomDomainAllowed(
    planCode: PlanCode,
    domain: string | null,
    tenantId: string,
  ): Promise<void> {
    // Retirer son domaine reste toujours possible : un vendeur rétrogradé ne
    // doit pas rester bloqué avec une valeur que son plan n'autorise plus.
    if (domain === null) return

    if (!PLAN_LIMITS[planCode].customDomain) {
      throw new AppException('PLAN_LIMIT_REACHED', `plan ${planCode} has no custom domain`, {
        userMessageKey: 'settings.errors.domainRequiresPro',
        fields: { customDomain: 'settings.errors.domainRequiresPro' },
      })
    }

    /*
     * Unicité vérifiée ICI plutôt qu'en laissant remonter la violation
     * d'unicité SQL : la contrainte est GLOBALE (un domaine n'appartient qu'à
     * une boutique), donc la collision se produit avec la ligne d'un AUTRE
     * tenant. Une P2002 nue fuiterait l'existence de cette boutique concurrente
     * dans les journaux, et donnerait à l'utilisateur un message illisible.
     */
    const clash = await this.prisma.tenant.findUnique({
      where: { customDomain: domain },
      select: { id: true },
    })

    if (clash && clash.id !== tenantId) {
      throw new AppException('CONFLICT', 'custom domain already registered', {
        userMessageKey: 'settings.errors.domainTaken',
        fields: { customDomain: 'settings.errors.domainTaken' },
      })
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

function toSettings(row: TenantRow): TenantSettings {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status as TenantStatus,
    planCode: row.planCode as PlanCode,
    // `null` en base, ABSENT dans le contrat : le schéma déclare le champ
    // optionnel, pas nullable.
    ...(row.customDomain ? { customDomain: row.customDomain } : {}),
    countryCode: row.countryCode,
    defaultCurrency: row.defaultCurrency,
    theme: (row.themeJson as TenantSettings['theme']) ?? {},
    createdAt: row.createdAt.toISOString(),
  }
}
