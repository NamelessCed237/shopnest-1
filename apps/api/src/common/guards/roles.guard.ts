import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { UserRole } from '@shopnest/contracts'
import { AppException } from '../errors/app.exception'
import { PUBLIC_KEY, ROLES_KEY } from '../decorators'
import type { AuthenticatedRequest } from './jwt-auth.guard'

/**
 * doc/03 §5 — RBAC au niveau de la route.
 *
 * Une route non publique SANS @Roles est refusée. Un décorateur oublié doit
 * fermer l'accès, jamais l'ouvrir (défaut sécurisé — doc/02 §1.6).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const allowed = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!allowed || allowed.length === 0) {
      throw new AppException(
        'FORBIDDEN',
        `route ${context.getClass().name}.${context.getHandler().name} has no @Roles nor @Public`,
      )
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!user) throw new AppException('UNAUTHENTICATED', 'no session on request')

    if (!allowed.includes(user.role)) {
      throw new AppException('FORBIDDEN', `role ${user.role} not in [${allowed.join(', ')}]`)
    }

    return true
  }
}
