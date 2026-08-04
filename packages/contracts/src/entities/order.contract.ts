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
  /**
   * Nom d'affichage de l'acheteur, joint par le serveur.
   *
   * Redondant avec `customerId`, et assumé : la liste des commandes affiche un
   * nom sur chaque ligne. Sans ce champ, le client devrait charger chaque fiche
   * pour l'obtenir — un N+1 par page — ou n'afficher qu'un identifiant, ce qui
   * rend l'écran inutilisable.
   *
   * Absent pour une commande passée en invité.
   */
  customerName: z.string().optional(),
  status: z.enum(ORDER_STATUS),
  items: z.array(OrderItemSchema),
  subtotal: MoneySchema,
  shipping: MoneySchema,
  tax: MoneySchema,
  discount: MoneySchema,
  total: MoneySchema,
  /** Commission ShopNest prélevée sur la vente — voir PLAN_LIMITS.transactionFeeRate. */
  platformFee: MoneySchema,
  /** Cumul des remboursements. Absent tant qu'aucun remboursement n'a eu lieu. */
  refundedAmount: MoneySchema.optional(),
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

/**
 * doc §10.2 du cahier des charges — traitement des commandes.
 *
 * Les transitions autorisées sont définies ICI, pas dans l'écran : le backend
 * doit refuser une transition invalide même si un client bogué la demande, et
 * l'interface ne doit proposer que ce que le serveur accepterait. Une seule
 * table pour les deux (doc/02 §1.2).
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['awaiting_payment', 'paid', 'cancelled'],
  awaiting_payment: ['paid', 'payment_failed', 'cancelled'],
  paid: ['preparing', 'cancelled', 'refunded'],
  preparing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  // États terminaux : plus aucune transition. Une commande livrée peut encore
  // être remboursée, mais c'est une opération de paiement, pas un changement
  // de statut — elle passe par l'endpoint de remboursement.
  delivered: [],
  cancelled: [],
  refunded: [],
  payment_failed: ['cancelled'],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to)
}

/** Un remboursement reste possible tant que l'argent a été encaissé. */
export const REFUNDABLE_STATUSES: readonly OrderStatus[] = [
  'paid',
  'preparing',
  'shipped',
  'delivered',
]

/**
 * Statuts qui comptent dans le CHIFFRE D'AFFAIRES.
 *
 * Même liste que `REFUNDABLE_STATUSES` aujourd'hui, et pourtant délibérément
 * distincte : « l'argent est encaissé, on peut le rendre » et « la vente compte
 * dans le CA » sont deux questions différentes, qui divergeront le jour où un
 * statut « en litige » apparaîtra. Les fusionner ferait bouger l'un en corrigeant
 * l'autre.
 *
 * Vit dans le contrat parce que le tableau de bord, la fiche client et l'API
 * doivent annoncer le même chiffre — un écart ici se lit comme une erreur
 * comptable.
 */
export const REVENUE_STATUSES: readonly OrderStatus[] = [
  'paid',
  'preparing',
  'shipped',
  'delivered',
]

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUS),
  /** doc/03 §6 — rejouer la requête ne doit pas produire deux transitions. */
  idempotencyKey: z.string().uuid(),
})
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>

export const RefundOrderSchema = z.object({
  /** Montant en unités mineures. Doit rester ≤ (total − déjà remboursé). */
  amountCents: z.number().int().positive(),
  reason: z.string().min(1).max(500),
  idempotencyKey: z.string().uuid(),
})
export type RefundOrderInput = z.infer<typeof RefundOrderSchema>

export const ListOrdersQuerySchema = CursorQuerySchema.extend({
  status: z.enum(ORDER_STATUS).optional(),
  /**
   * Le tableau des commandes propose ce filtre. Il vit donc dans le contrat et
   * non dans les seules fixtures : un filtre que l'interface affiche mais que
   * le serveur ignore ne renvoie pas d'erreur — il renvoie simplement tout,
   * et le vendeur croit avoir filtré.
   */
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  customerId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>
