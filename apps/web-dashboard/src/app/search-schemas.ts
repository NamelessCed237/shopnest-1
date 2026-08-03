import { z } from 'zod'
import {
  CUSTOMER_SEGMENTS,
  DASHBOARD_RANGES,
  ORDER_STATUS,
  PAYMENT_METHODS,
  PRODUCT_STATUS,
} from '@shopnest/contracts'

/**
 * Les paramètres d'URL sont une ENTRÉE UTILISATEUR : n'importe qui peut taper
 * `?status=nimporte-quoi`. On les valide donc comme n'importe quelle entrée
 * (doc/02 §11), plutôt que de les caster et de propager une valeur invalide
 * jusqu'à la requête API.
 */
/**
 * `redirect` vient de l'URL, donc d'une source non fiable : une valeur absolue
 * permettrait une redirection ouverte vers un site tiers après connexion.
 * On n'accepte qu'un chemin interne.
 */
export const LoginSearchSchema = z.object({
  redirect: z
    .string()
    .startsWith('/')
    .refine((value) => !value.startsWith('//'), 'chemin interne uniquement')
    .optional(),
})

export type LoginSearch = z.infer<typeof LoginSearchSchema>

export const ProductsSearchSchema = z.object({
  search: z.string().max(200).optional(),
  status: z.enum(PRODUCT_STATUS).optional(),
  categoryId: z.string().optional(),
  sortBy: z.enum(['createdAt', 'name', 'price', 'stock']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type ProductsSearch = z.infer<typeof ProductsSearchSchema>

export const OrdersSearchSchema = z.object({
  search: z.string().max(200).optional(),
  status: z.enum(ORDER_STATUS).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  sortBy: z.enum(['createdAt', 'total']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type OrdersSearch = z.infer<typeof OrdersSearchSchema>

/** La période du tableau de bord vit aussi dans l'URL : un lien partagé montre
 *  la même période à tout le monde (doc/04 §3). */
export const OverviewSearchSchema = z.object({
  range: z.enum(DASHBOARD_RANGES).default('30d'),
})

export type OverviewSearch = z.infer<typeof OverviewSearchSchema>

export const CustomersSearchSchema = z.object({
  search: z.string().max(200).optional(),
  segment: z.enum(CUSTOMER_SEGMENTS).optional(),
  sortBy: z.enum(['lastOrderAt', 'totalSpent', 'orderCount', 'name']).default('lastOrderAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type CustomersSearch = z.infer<typeof CustomersSearchSchema>
