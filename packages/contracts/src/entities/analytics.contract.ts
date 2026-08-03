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
