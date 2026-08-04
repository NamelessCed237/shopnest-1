import { z } from 'zod'
import { PLAN_CODES } from './plan.contract.js'

export const TENANT_STATUS = ['trialing', 'active', 'past_due', 'suspended', 'cancelled'] as const
export type TenantStatus = (typeof TENANT_STATUS)[number]

/**
 * Modes d'affichage proposables comme DÉFAUT d'une boutique.
 *
 * `system` suit le réglage du système d'exploitation du visiteur. C'est le
 * défaut : imposer un thème à quelqu'un qui a configuré son appareil en sombre
 * est une décision qui doit être prise volontairement, pas héritée.
 */
export const TENANT_THEME_MODES = ['system', 'light', 'dark'] as const
export type TenantThemeMode = (typeof TENANT_THEME_MODES)[number]

/**
 * Identité visuelle d'une boutique.
 *
 * UNE seule couleur, et non quatre : les teintes de survol, le fond discret et
 * la couleur du texte posé dessus sont dérivées par `deriveBrandPalette`
 * (@shopnest/tokens). Les demander séparément produirait des combinaisons dont
 * personne ne vérifie le contraste.
 */
export const TenantThemeSchema = z.object({
  /**
   * Couleur de marque, en `#rrggbb`.
   *
   * Format strict — ni `red`, ni `#abc`, ni `rgb(...)`. La valeur est convertie
   * en triplet RGB pour alimenter une variable CSS : accepter d'autres notations
   * obligerait à embarquer un analyseur de couleurs dans chaque client.
   */
  brandPrimary: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'errors.tenant.invalidColor')
    .optional(),
  logoUrl: z.string().url().optional(),
  defaultMode: z.enum(TENANT_THEME_MODES).default('system'),
})
export type TenantTheme = z.infer<typeof TenantThemeSchema>

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
  theme: TenantThemeSchema.default({}),
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
