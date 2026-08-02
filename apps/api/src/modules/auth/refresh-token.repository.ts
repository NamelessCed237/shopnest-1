import { Injectable } from '@nestjs/common'
import type { SessionUser, TokenAudience, UserRole } from '@shopnest/contracts'
import { AppException } from '../../common/errors/app.exception'
import { PrismaService } from '../../database/prisma.service'

export interface CreateRefreshTokenInput {
  userId: string
  audience: TokenAudience
  tenantId?: string
  tokenHash: string
  familyId: string
  expiresAt: Date
}

export interface StoredRefreshToken {
  id: string
  userId: string
  audience: TokenAudience
  tenantId: string | null
  familyId: string
  expiresAt: Date
  revokedAt: Date | null
}

/**
 * `refresh_tokens` est un modèle GLOBAL (absent de TENANT_SCOPED_MODELS) : le
 * rafraîchissement précède la résolution du tenant, et un super admin n'en a pas.
 * On utilise donc le client BRUT, jamais `withTenantIsolation()`.
 *
 * Ce n'est pas un contournement de l'isolation : toutes les lectures se font par
 * `tokenHash` unique, jamais par tenant. Aucune requête ne peut énumérer les
 * sessions d'un autre vendeur.
 */
@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateRefreshTokenInput): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        audience: input.audience,
        tenantId: input.tenantId ?? null,
        tokenHash: input.tokenHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
      },
    })
  }

  async findByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } })
    return row as StoredRefreshToken | null
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
  }

  /** Rejeu détecté ou déconnexion : toute la chaîne issue du même login tombe. */
  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  /** Purge des tokens expirés — appelée par un job nocturne. */
  async purgeExpired(): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    return count
  }

  /**
   * Recharge l'utilisateur depuis la base à chaque rotation.
   *
   * On ne fait pas confiance au contenu du token : si le rôle a été rétrogradé ou
   * le compte supprimé depuis l'émission, le refresh doit le refléter immédiatement.
   */
  async resolveUser(token: StoredRefreshToken): Promise<SessionUser> {
    switch (token.audience) {
      case 'tenant': {
        const user = await this.prisma.tenantUser.findUnique({ where: { id: token.userId } })
        if (!user) throw new AppException('UNAUTHENTICATED', 'tenant user no longer exists')
        return {
          id: user.id,
          email: user.email,
          role: user.role as UserRole,
          audience: 'tenant',
          tenantId: user.tenantId,
        }
      }
      case 'customer': {
        const customer = await this.prisma.customer.findUnique({ where: { id: token.userId } })
        if (!customer) throw new AppException('UNAUTHENTICATED', 'customer no longer exists')
        return {
          id: customer.id,
          email: customer.email,
          role: 'customer',
          audience: 'customer',
          tenantId: customer.tenantId,
        }
      }
      case 'admin': {
        const admin = await this.prisma.superAdmin.findUnique({ where: { id: token.userId } })
        if (!admin) throw new AppException('UNAUTHENTICATED', 'super admin no longer exists')
        return { id: admin.id, email: admin.email, role: 'super_admin', audience: 'admin' }
      }
    }
  }
}
