import { z } from 'zod'
import { PLAN_CODES } from './plan.contract.js'

export const TENANT_STATUS = ['trialing', 'active', 'past_due', 'suspended', 'cancelled'] as const
export type TenantStatus = (typeof TENANT_STATUS)[number]

export const TenantSchema = z.object({
  id: z.string().uuid(),
  /** Sous-domaine : <slug>.shopnest.app */
  slug: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'errors.tenant.invalidSlug'),
  name: z.string().min(1).max(120),
  status: z.enum(TENANT_STATUS),
  planCode: z.enum(PLAN_CODES),
  /** Plans Pro et Enterprise uniquement. */
  customDomain: z.string().optional(),
  countryCode: z.string().length(2),
  defaultCurrency: z.string().length(3),
  theme: z
    .object({
      brandPrimary: z.string().optional(),
      logoUrl: z.string().url().optional(),
    })
    .default({}),
  createdAt: z.string().datetime(),
})
export type Tenant = z.infer<typeof TenantSchema>

export const USER_ROLES = [
  'customer',
  'tenant_staff',
  'tenant_admin',
  'super_admin',
] as const
export type UserRole = (typeof USER_ROLES)[number]

/** doc/03 §5 — trois audiences JWT distinctes, secrets et durées différents. */
export const TOKEN_AUDIENCES = ['customer', 'tenant', 'admin'] as const
export type TokenAudience = (typeof TOKEN_AUDIENCES)[number]

export const JwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  aud: z.enum(TOKEN_AUDIENCES),
  role: z.enum(USER_ROLES),
  /** tenant id — absent pour un super admin. */
  tid: z.string().uuid().optional(),
  exp: z.number(),
})
export type JwtPayload = z.infer<typeof JwtPayloadSchema>
