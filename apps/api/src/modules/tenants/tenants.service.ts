import { Injectable } from '@nestjs/common'
import type { PlanCode, TenantStatus } from '@shopnest/contracts'
import { PrismaService } from '../../database/prisma.service'

export interface ResolvedTenant {
  id: string
  slug: string
  status: TenantStatus
  planCode: PlanCode
}

/**
 * `Tenant` est un modèle GLOBAL (absent de TENANT_SCOPED_MODELS) : il est lu
 * avec le client brut, avant que le contexte tenant n'existe.
 */
@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Résout par slug (sous-domaine), domaine personnalisé ou id.
   * TODO(#2): cache Redis — cette requête est sur le chemin de CHAQUE requête HTTP.
   */
  async findByIdentifier(identifier: string): Promise<ResolvedTenant | null> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: identifier }, { customDomain: identifier }, { id: identifier }],
      },
      select: { id: true, slug: true, status: true, planCode: true },
    })
    return tenant as ResolvedTenant | null
  }
}
