import { Injectable, mixin, type CanActivate, type Type } from '@nestjs/common'
import { PLAN_LIMITS } from '@shopnest/contracts'
import { AppException } from '../errors/app.exception'
import { TenantContext } from '../../tenancy/tenant-context'
import { PrismaService } from '../../database/prisma.service'

type QuotaResource = 'products' | 'staffUsers'

const QUOTA_LIMIT_KEY = {
  products: 'maxProducts',
  staffUsers: 'maxStaffUsers',
} as const satisfies Record<QuotaResource, keyof (typeof PLAN_LIMITS)['basic']>

/**
 * doc/03 §10 — le quota du plan est vérifié AVANT d'atteindre le service.
 * La limite vient de PLAN_LIMITS (@shopnest/contracts), source unique — doc/02 §1.2.
 */
export function PlanLimitGuard(resource: QuotaResource): Type<CanActivate> {
  @Injectable()
  class Guard implements CanActivate {
    constructor(readonly prisma: PrismaService) {}

    async canActivate(): Promise<boolean> {
      const ctx = TenantContext.get()
      if (!ctx) throw new AppException('FORBIDDEN', 'tenant context missing')

      const limit = PLAN_LIMITS[ctx.plan][QUOTA_LIMIT_KEY[resource]]
      if (limit === Number.POSITIVE_INFINITY) return true

      // count() en base : on ne charge pas les lignes pour les compter (doc/02 §2.3).
      const used = await this.countUsed(resource)
      if (used >= limit) {
        throw new AppException(
          'PLAN_LIMIT_REACHED',
          `plan ${ctx.plan} limit reached for ${resource}: ${used}/${limit}`,
        )
      }
      return true
    }

    private countUsed(res: QuotaResource): Promise<number> {
      const db = this.prisma.withTenantIsolation()
      // Le filtre tenantId est injecté automatiquement par l'extension.
      if (res === 'products') return db.product.count({ where: { deletedAt: null } })
      return db.tenantUser.count()
    }
  }

  return mixin(Guard)
}
