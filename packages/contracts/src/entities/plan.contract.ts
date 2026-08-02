import { z } from 'zod'
import { MoneySchema } from '../primitives/money.js'

export const PLAN_CODES = ['basic', 'pro', 'enterprise'] as const
export type PlanCode = (typeof PLAN_CODES)[number]

/**
 * doc/02 §1.2 — SOURCE DE VÉRITÉ UNIQUE des limites et tarifs.
 *
 * Cette constante est importée par : le guard de quota backend, le seed, la page
 * tarifs du storefront, le dashboard vendeur et le back-office admin.
 * Une limite ne se change qu'ICI.
 */
export const PLAN_LIMITS = {
  basic: {
    maxProducts: 100,
    maxStaffUsers: 1,
    transactionFeeRate: 0.025,
    customDomain: false,
    advancedAnalytics: false,
    bankTransfer: false,
  },
  pro: {
    maxProducts: 5_000,
    maxStaffUsers: 5,
    transactionFeeRate: 0.015,
    customDomain: true,
    advancedAnalytics: true,
    bankTransfer: false,
  },
  enterprise: {
    maxProducts: Number.POSITIVE_INFINITY,
    maxStaffUsers: Number.POSITIVE_INFINITY,
    /** Négocié au cas par cas : pas de taux par défaut. */
    transactionFeeRate: null,
    customDomain: true,
    advancedAnalytics: true,
    bankTransfer: true,
  },
} as const satisfies Record<PlanCode, PlanLimits>

export interface PlanLimits {
  maxProducts: number
  maxStaffUsers: number
  transactionFeeRate: number | null
  customDomain: boolean
  advancedAnalytics: boolean
  bankTransfer: boolean
}

/** Fonctionnalités activables par feature flag — doc §11.2 du cahier des charges. */
export const FEATURE_FLAGS = [
  'customDomain',
  'advancedAnalytics',
  'bankTransfer',
  'multiCurrency',
  'abandonedCartRecovery',
] as const
export type FeatureFlag = (typeof FEATURE_FLAGS)[number]

export const PlanSchema = z.object({
  code: z.enum(PLAN_CODES),
  name: z.string(),
  monthlyPrice: MoneySchema,
  yearlyPrice: MoneySchema,
  features: z.array(z.enum(FEATURE_FLAGS)),
})
export type Plan = z.infer<typeof PlanSchema>

export function planAllows(plan: PlanCode, flag: FeatureFlag): boolean {
  const limits: PlanLimits = PLAN_LIMITS[plan]
  return flag in limits ? Boolean(limits[flag as keyof PlanLimits]) : false
}
