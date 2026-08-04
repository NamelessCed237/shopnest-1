import { z } from 'zod'
import { MoneySchema } from '../primitives/money.js'
import { PLAN_CODES } from './plan.contract.js'

/**
 * Écran FACTURATION — ce que le vendeur consomme et ce qu'il paie.
 *
 * Les LIMITES du plan ne sont volontairement PAS transportées ici : elles
 * vivent dans `PLAN_LIMITS` (@shopnest/contracts), que le client importe déjà.
 * Les renvoyer créerait une deuxième source de vérité, et surtout
 * `maxProducts: Infinity` du plan Enterprise ne survit pas à un aller-retour
 * JSON — `JSON.stringify(Infinity)` vaut `null`.
 *
 * Le serveur envoie donc le code du plan et la CONSOMMATION ; le client
 * rapproche les deux.
 */
export const BillingUsageSchema = z.object({
  products: z.number().int().min(0),
  staffUsers: z.number().int().min(0),
})
export type BillingUsage = z.infer<typeof BillingUsageSchema>

/** Une ligne du relevé mensuel. */
export const BillingPeriodSchema = z.object({
  /** Premier jour du mois, ISO, en UTC. */
  month: z.string().datetime(),
  orderCount: z.number().int().min(0),
  revenue: MoneySchema,
  /** Commission ShopNest prélevée sur les ventes encaissées du mois. */
  fees: MoneySchema,
})
export type BillingPeriod = z.infer<typeof BillingPeriodSchema>

export const BillingSummarySchema = z.object({
  planCode: z.enum(PLAN_CODES),
  usage: BillingUsageSchema,
  /** Mois en cours, mois précédent, puis cumul depuis l'ouverture. */
  currentMonthFees: MoneySchema,
  previousMonthFees: MoneySchema,
  lifetimeFees: MoneySchema,
  /** Douze derniers mois, du plus ancien au plus récent. */
  history: z.array(BillingPeriodSchema),
})
export type BillingSummary = z.infer<typeof BillingSummarySchema>

/**
 * Part d'un quota déjà consommée, entre 0 et 1.
 *
 * Exportée plutôt que recalculée dans chaque jauge : `Infinity` au dénominateur
 * donne `0`, ce qui est le bon affichage pour un plan sans limite — mais c'est
 * exactement le genre de cas qu'on oublie en écrivant la division à la main,
 * et qui produit un `NaN` dans une barre de progression.
 */
export function quotaRatio(used: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0
  return Math.min(used / limit, 1)
}
