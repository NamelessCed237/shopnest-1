import { SetMetadata } from '@nestjs/common'
import type { UserRole } from '@shopnest/contracts'

export const ROLES_KEY = 'shopnest:roles'
export const PUBLIC_KEY = 'shopnest:public'
export const CROSS_TENANT_KEY = 'shopnest:crossTenant'
export const AUDITED_KEY = 'shopnest:audited'

/** doc/03 §10 — @Roles explicite, ou @Public explicite. Jamais implicite. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles)

export const Public = () => SetMetadata(PUBLIC_KEY, true)

/**
 * doc/03 §3.5 — l'accès inter-tenant n'est JAMAIS implicite.
 * Toujours accompagné de @Audited : une impersonation sans audit est un bug bloquant.
 */
export const CrossTenant = () => SetMetadata(CROSS_TENANT_KEY, true)

export const Audited = (action: string) => SetMetadata(AUDITED_KEY, action)
