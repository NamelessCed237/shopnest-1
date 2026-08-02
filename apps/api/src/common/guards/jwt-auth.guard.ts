import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import type { SessionUser, TokenAudience, UserRole } from '@shopnest/contracts'
import { AppException } from '../errors/app.exception'
import { PUBLIC_KEY } from '../decorators'
import { TokenService } from '../../modules/auth/token.service'
import { TenantContext } from '../../tenancy/tenant-context'

export interface AuthenticatedRequest extends Request {
  user?: SessionUser
}

/**
 * Guard GLOBAL — doc/03 §10 : une route est protégée par défaut.
 * Il faut un @Public() explicite pour l'ouvrir ; l'oubli ferme, il n'ouvre pas.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = extractBearer(request)
    if (!token) throw new AppException('UNAUTHENTICATED', 'missing bearer token')

    // L'audience est déduite du chemin, pas du token : un token ne doit jamais
    // pouvoir déclarer lui-même sur quelle surface il est valide.
    const audience = audienceForPath(request.path)
    const payload = await this.tokens.verifyAccessToken(token, audience)

    if (payload.aud !== audience) {
      throw new AppException('UNAUTHENTICATED', `audience mismatch: ${payload.aud} on ${audience}`)
    }

    // Contrepartie du décodage non vérifié fait par TenantResolverMiddleware :
    // on confirme ici, signature à l'appui, que le tenant ouvert dans le contexte
    // est bien celui du token. Sans ce contrôle, un token valide pour la boutique A
    // pourrait travailler dans le contexte de la boutique B.
    const contextTenantId = TenantContext.get()?.tenantId
    if (payload.tid && contextTenantId && payload.tid !== contextTenantId) {
      throw new AppException('FORBIDDEN', `token tenant ${payload.tid} != context ${contextTenantId}`)
    }

    request.user = {
      id: payload.sub,
      email: '',
      role: payload.role as UserRole,
      audience: payload.aud,
      ...(payload.tid ? { tenantId: payload.tid } : {}),
    }
    return true
  }
}

function extractBearer(request: Request): string | undefined {
  const header = request.header('authorization')
  if (!header?.startsWith('Bearer ')) return undefined
  return header.slice('Bearer '.length).trim() || undefined
}

/** `/api/admin/*` → audience admin, `/api/storefront/*` → customer, sinon tenant. */
function audienceForPath(path: string): TokenAudience {
  if (path.includes('/admin/')) return 'admin'
  if (path.includes('/storefront/') || path.includes('/customer/')) return 'customer'
  return 'tenant'
}
