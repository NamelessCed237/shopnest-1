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

/**
 * Adresse de livraison RECOPIÉE sur la commande, jamais référencée.
 *
 * `CreateOrderSchema` demandait un `shippingAddressId`, ce qui suppose un
 * carnet d'adresses, donc un compte, donc une inscription avant tout achat.
 * Sur les marchés visés, l'écrasante majorité des commandes sont passées en
 * invité : imposer un compte, c'est perdre la vente.
 *
 * Elle est donc recopiée comme `productName` l'est sur la ligne : une commande
 * doit rester lisible telle qu'elle a été passée, même si l'acheteur déménage
 * ensuite ou corrige sa fiche.
 */
/*
 * Chaque contrainte porte une CLÉ de message, pas un texte.
 *
 * Sans elles, zod fabrique le sien — « String must contain at least 3
 * character(s) » — et c'est ce texte qui s'affiche sous le champ, en anglais,
 * dans un formulaire français, devant un acheteur sur le point de payer. Les
 * écrans résolvent `t(message)` : une clé inconnue tombe en français, un
 * message anglais s'affiche tel quel.
 */
export const ShippingAddressSchema = z.object({
  fullName: z.string().min(2, 'errors.address.fullName').max(120, 'errors.address.tooLong'),
  /**
   * Obligatoire, contrairement à l'usage européen : c'est par téléphone que le
   * livreur joint l'acheteur, et l'adresse écrite est souvent approximative
   * (« derrière la station Total »). Sans numéro, la livraison échoue.
   */
  phone: z.string().min(8, 'errors.address.phone').max(20, 'errors.address.phone'),
  line1: z.string().min(3, 'errors.address.line1').max(200, 'errors.address.tooLong'),
  line2: z.string().max(200, 'errors.address.tooLong').optional(),
  city: z.string().min(2, 'errors.address.city').max(120, 'errors.address.tooLong'),
  region: z.string().max(120, 'errors.address.tooLong').optional(),
  /** Facultatif : plusieurs pays visés n'ont pas de code postal généralisé. */
  postalCode: z.string().max(20, 'errors.address.tooLong').optional(),
  /** ISO 3166-1 alpha-2. */
  country: z.string().length(2, 'errors.address.country').toUpperCase(),
})
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>

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
  /**
   * Absente des commandes créées avant le tunnel d'achat — d'où l'optionnel.
   * Le vendeur ne peut pas expédier sans elle ; l'écran de détail le dit
   * plutôt que d'afficher un bloc vide.
   */
  shippingAddress: ShippingAddressSchema.optional(),
  /** Courriel de l'acheteur, seul point de contact d'une commande invité. */
  email: z.string().email().optional(),
  createdAt: z.string().datetime(),
})
export type Order = z.infer<typeof OrderSchema>

/*
 * La création d'une commande vit dans `checkout.contract.ts`.
 *
 * Un `CreateOrderSchema` figurait ici, jamais implémenté et jamais importé. Il
 * demandait un `shippingAddressId`, donc un carnet d'adresses, donc un compte
 * avant tout achat — l'inverse de ce que le tunnel doit permettre. Le
 * remplacer sur place aurait laissé deux portes d'entrée pour une seule
 * opération ; il est supprimé, et `CheckoutSchema` est la seule.
 */

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
