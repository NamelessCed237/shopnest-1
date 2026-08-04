import { z } from 'zod'
import { MoneySchema } from '../primitives/money.js'
import { CursorQuerySchema } from '../primitives/pagination.js'
import { PLAN_CODES } from './plan.contract.js'
import { TENANT_STATUS, TenantSchema, TenantThemeSchema } from './tenant.contract.js'

/**
 * Back-office SUPER-ADMIN — vue transverse sur toutes les boutiques.
 *
 * Ces routes sont les seules du produit à franchir la frontière du tenant.
 * Elles exigent l'audience `admin` (doc/03 §5), et chaque accès inter-tenant
 * est journalisé (doc/03 §3.5).
 */

/** Une boutique vue depuis l'administration : profil + quelques compteurs. */
export const AdminTenantSchema = TenantSchema.extend({
  productCount: z.number().int().min(0),
  orderCount: z.number().int().min(0),
  /** Chiffre d'affaires encaissé, toutes périodes. */
  revenue: MoneySchema,
  lastOrderAt: z.string().datetime().optional(),
})
export type AdminTenant = z.infer<typeof AdminTenantSchema>

export const ListTenantsQuerySchema = CursorQuerySchema.extend({
  status: z.enum(TENANT_STATUS).optional(),
  planCode: z.enum(PLAN_CODES).optional(),
})
export type ListTenantsQuery = z.infer<typeof ListTenantsQuerySchema>

/**
 * Ce qu'un super-admin peut changer sur une boutique.
 *
 * Le THÈME et le PLAN, rien d'autre. Le nom et le domaine appartiennent au
 * vendeur — les modifier depuis l'administration reviendrait à agir à sa place
 * sans qu'il le sache. Le statut a ses propres transitions (suspension,
 * résiliation), qui déclenchent des effets et ne se réduisent pas à un champ.
 */
export const UpdateTenantThemeSchema = z.object({
  theme: TenantThemeSchema,
})
export type UpdateTenantThemeInput = z.infer<typeof UpdateTenantThemeSchema>

export const UpdateTenantPlanSchema = z.object({
  planCode: z.enum(PLAN_CODES),
})
export type UpdateTenantPlanInput = z.infer<typeof UpdateTenantPlanSchema>

/** Chiffres de tête de la page d'accueil de l'administration. */
export const PlatformSummarySchema = z.object({
  tenantCount: z.number().int().min(0),
  activeTenantCount: z.number().int().min(0),
  productCount: z.number().int().min(0),
  orderCount: z.number().int().min(0),
  /**
   * Commissions cumulées, toutes boutiques.
   *
   * ⚠️ Somme d'entiers de centimes provenant de DEVISES DIFFÉRENTES. Elle n'a
   * de sens que si toutes les boutiques partagent la même devise, ce qui n'est
   * pas garanti : `mixedCurrencies` le signale pour que l'écran affiche un
   * avertissement au lieu d'un total trompeur.
   */
  platformFees: MoneySchema,
  mixedCurrencies: z.boolean(),
})
export type PlatformSummary = z.infer<typeof PlatformSummarySchema>
