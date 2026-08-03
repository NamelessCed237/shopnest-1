import { z } from 'zod'
import { MoneySchema } from '../primitives/money.js'
import { CursorQuerySchema } from '../primitives/pagination.js'

export const CustomerSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  createdAt: z.string().datetime(),
})
export type Customer = z.infer<typeof CustomerSchema>

/**
 * doc §10.3 du cahier des charges — « segmentation basique ».
 *
 * Le segment est CALCULÉ côté serveur, pas dans l'écran : deux clients (web,
 * mobile, export CSV) doivent classer le même acheteur de la même façon.
 */
export const CUSTOMER_SEGMENTS = ['new', 'returning', 'loyal', 'dormant'] as const
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number]

/** Seuils de segmentation — source unique, comme PLAN_LIMITS (doc/02 §1.2). */
export const SEGMENT_RULES = {
  /** Au-delà de ce nombre de commandes, le client est « fidèle ». */
  loyalOrderCount: 5,
  /** Sans commande depuis ce délai, le client bascule en « dormant ». */
  dormantDays: 90,
} as const

export const CustomerSummarySchema = CustomerSchema.extend({
  orderCount: z.number().int().min(0),
  /** Somme des commandes ENCAISSÉES uniquement. */
  totalSpent: MoneySchema,
  averageOrderValue: MoneySchema,
  firstOrderAt: z.string().datetime().optional(),
  lastOrderAt: z.string().datetime().optional(),
  segment: z.enum(CUSTOMER_SEGMENTS),
})
export type CustomerSummary = z.infer<typeof CustomerSummarySchema>

export const ListCustomersQuerySchema = CursorQuerySchema.extend({
  segment: z.enum(CUSTOMER_SEGMENTS).optional(),
  sortBy: z.enum(['lastOrderAt', 'totalSpent', 'orderCount', 'name']).default('lastOrderAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})
export type ListCustomersQuery = z.infer<typeof ListCustomersQuerySchema>

/**
 * Classement d'un acheteur. Exportée pour que le backend, les fixtures et les
 * tests appliquent littéralement la même règle.
 */
export function computeSegment(input: {
  orderCount: number
  lastOrderAt?: string
  now: number
}): CustomerSegment {
  if (input.orderCount === 0) return 'new'

  if (input.lastOrderAt) {
    const daysSince = (input.now - new Date(input.lastOrderAt).getTime()) / 86_400_000
    if (daysSince > SEGMENT_RULES.dormantDays) return 'dormant'
  }

  if (input.orderCount >= SEGMENT_RULES.loyalOrderCount) return 'loyal'
  return input.orderCount === 1 ? 'new' : 'returning'
}
