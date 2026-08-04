import { z } from 'zod'
import { MoneySchema } from '../primitives/money.js'

/** Point d'une série temporelle — une valeur par jour. */
export const RevenuePointSchema = z.object({
  /** Date ISO (jour), en UTC. La conversion locale se fait à l'affichage. */
  date: z.string().datetime(),
  revenue: MoneySchema,
  orderCount: z.number().int().min(0),
})
export type RevenuePoint = z.infer<typeof RevenuePointSchema>

/**
 * Une métrique et son évolution par rapport à la période précédente de même durée.
 * Le delta est calculé côté serveur : deux clients ne doivent pas pouvoir afficher
 * deux variations différentes pour la même donnée.
 */
export const MetricDeltaSchema = z.object({
  /** Variation relative, ex. 0.124 pour +12,4 %. Null si la période précédente est vide. */
  ratio: z.number().nullable(),
})
export type MetricDelta = z.infer<typeof MetricDeltaSchema>

export const DASHBOARD_RANGES = ['7d', '30d', '90d'] as const
export type DashboardRange = (typeof DASHBOARD_RANGES)[number]

export const DashboardSummarySchema = z.object({
  range: z.enum(DASHBOARD_RANGES),
  revenue: MoneySchema,
  revenueDelta: MetricDeltaSchema,
  orderCount: z.number().int(),
  orderCountDelta: MetricDeltaSchema,
  averageOrderValue: MoneySchema,
  averageOrderValueDelta: MetricDeltaSchema,
  /** Produits dont le stock est sous le seuil configuré, rupture comprise. */
  lowStockCount: z.number().int(),
  outOfStockCount: z.number().int(),
  series: z.array(RevenuePointSchema),
})
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>

/**
 * Ce dont la tuile « alertes stock » a besoin, et rien de plus.
 *
 * Une vue restreinte plutôt que `Product` : la tuile n'affiche qu'un nom et une
 * jauge. Transporter le produit entier ferait voyager description, images et
 * variantes — pour cinq lignes, à chaque ouverture du tableau de bord — et
 * lierait cet écran à toute évolution du schéma produit.
 */
export const LowStockProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0),
})
export type LowStockProduct = z.infer<typeof LowStockProductSchema>

/**
 * Écran STATISTIQUES — les ventilations que le tableau de bord ne montre pas.
 *
 * Le tableau de bord répond à « comment va la boutique aujourd'hui ». Celui-ci
 * répond à « d'où vient l'argent » : quels produits, quelles catégories, quels
 * moyens de paiement. Deux questions différentes, deux écrans — les fusionner
 * donnerait une page qu'on ne lit plus.
 */
export const TopProductSchema = z.object({
  productId: z.string().uuid(),
  name: z.string(),
  quantitySold: z.number().int().min(0),
  revenue: MoneySchema,
})
export type TopProduct = z.infer<typeof TopProductSchema>

export const PaymentMethodStatSchema = z.object({
  method: z.string(),
  orderCount: z.number().int().min(0),
  revenue: MoneySchema,
})
export type PaymentMethodStat = z.infer<typeof PaymentMethodStatSchema>

export const CategoryStatSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string(),
  quantitySold: z.number().int().min(0),
  revenue: MoneySchema,
})
export type CategoryStat = z.infer<typeof CategoryStatSchema>

export const StatisticsSummarySchema = z.object({
  range: z.enum(DASHBOARD_RANGES),
  topProducts: z.array(TopProductSchema),
  byPaymentMethod: z.array(PaymentMethodStatSchema),
  byCategory: z.array(CategoryStatSchema),
  /** Acheteurs dont la PREMIÈRE commande tombe dans la période. */
  newCustomers: z.number().int().min(0),
  returningCustomers: z.number().int().min(0),
})
export type StatisticsSummary = z.infer<typeof StatisticsSummarySchema>
