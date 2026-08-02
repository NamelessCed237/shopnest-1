import { Injectable, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { AppException } from '../common/errors/app.exception'
import { TenantContext } from './tenant-context'
import { TenantsService } from '../modules/tenants/tenants.service'
import { TokenService } from '../modules/auth/token.service'

/**
 * doc/03 §3.1 — s'exécute AVANT tout le reste, sur toutes les requêtes.
 *
 * Ordre de résolution :
 *   1. Sous-domaine          → boutique.shopnest.app   (storefront public)
 *   2. Domaine personnalisé  → boutique.com            (plans Pro / Enterprise)
 *   3. Claim `tid` du JWT    → dashboard vendeur, mobile
 *   4. En-tête X-Tenant-Id   → uniquement en développement
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    private readonly tenants: TenantsService,
    private readonly tokens: TokenService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const identifier = this.resolveIdentifier(req)

    // Routes globales : auth, plans publics, health, webhooks. Pas de contexte tenant.
    if (!identifier) {
      next()
      return
    }

    const tenant = await this.tenants.findByIdentifier(identifier)
    if (!tenant) {
      throw new AppException('NOT_FOUND', `tenant not found: ${identifier}`)
    }
    if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
      throw new AppException('TENANT_SUSPENDED', `tenant ${tenant.id} is ${tenant.status}`)
    }

    TenantContext.run({ tenantId: tenant.id, plan: tenant.planCode }, () => next())
  }

  private resolveIdentifier(req: Request): string | undefined {
    const host = req.hostname

    if (host.endsWith('.shopnest.app')) {
      const sub = host.slice(0, -'.shopnest.app'.length)
      if (sub && sub !== 'www' && sub !== 'api' && sub !== 'admin') return sub
    }

    // Domaine personnalisé : résolu en base (avec cache Redis).
    if (!host.endsWith('.shopnest.app') && !isLocalhost(host)) return host

    // Ce middleware s'exécute AVANT les guards : `req.user` n'existe pas encore.
    // On décode donc le bearer sans vérifier la signature — le JwtAuthGuard la
    // vérifie juste après et confirme que ce `tid` est bien celui du token signé.
    const header = req.header('authorization')
    if (header?.startsWith('Bearer ')) {
      const payload = this.tokens.decodeUnverified(header.slice('Bearer '.length).trim())
      if (payload?.tid) return payload.tid
    }

    if (process.env.NODE_ENV !== 'production') {
      const header = req.header('X-Tenant-Id')
      if (header) return header
    }

    return undefined
  }
}

const isLocalhost = (host: string) => host === 'localhost' || host === '127.0.0.1'
