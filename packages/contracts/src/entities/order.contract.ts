import { z } from 'zod'
import { MoneySchema } from '../primitives/money.js'
import { CursorQuerySchema } from '../primitives/pagination.js'

export const ORDER_STATUS = [
  'pending',
  'awaiting_payment',
  'paid',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'payment_failed',
] as const
export type OrderStatus = (typeof ORDER_STATUS)[number]

export const PAYMENT_METHODS = ['card', 'mtn_momo', 'orange_money', 'bank_transfer'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/**
 * doc/03 §6 — Mobile Money est asynchrone : `awaiting_confirmation` n'est pas un
 * détail d'implémentation, c'est un état que l'UI doit rendre explicitement.
 */
export const PAYMENT_STATUS = [
  'pending',
  'awaiting_confirmation',
  'settled',
  'failed',
  'expired',
  'refunded',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUS)[number]

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  /** Instantané au moment de la commande : le produit peut changer ou être archivé ensuite. */
  productName: z.string(),
  unitPrice: MoneySchema,
  quantity: z.number().int().min(1),
  lineTotal: MoneySchema,
})
export type OrderItem = z.infer<typeof OrderItemSchema>

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(PAYMENT_STATUS),
  amount: MoneySchema,
  provider: z.string(),
  /** Référence côté prestataire — sert à l'idempotence. */
  externalId: z.string().optional(),
  /** Échéance de confirmation Mobile Money (~2 min). */
  expiresAt: z.string().datetime().optional(),
})
export type Payment = z.infer<typeof PaymentSchema>

export const OrderSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  customerId: z.string().uuid().optional(),
  status: z.enum(ORDER_STATUS),
  items: z.array(OrderItemSchema),
  subtotal: MoneySchema,
  shipping: MoneySchema,
  tax: MoneySchema,
  discount: MoneySchema,
  total: MoneySchema,
  /** Commission ShopNest prélevée sur la vente — voir PLAN_LIMITS.transactionFeeRate. */
  platformFee: MoneySchema,
  payment: PaymentSchema.optional(),
  createdAt: z.string().datetime(),
})
export type Order = z.infer<typeof OrderSchema>

export const CreateOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1),
  paymentMethod: z.enum(PAYMENT_METHODS),
  /** Requis pour mtn_momo / orange_money. */
  payerPhone: z.string().min(8).max(20).optional(),
  shippingAddressId: z.string().uuid(),
  /** Clé d'idempotence fournie par le client — doc/03 §6. */
  idempotencyKey: z.string().uuid(),
})
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>

export const ListOrdersQuerySchema = CursorQuerySchema.extend({
  status: z.enum(ORDER_STATUS).optional(),
  customerId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>
