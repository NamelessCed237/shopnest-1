import { z } from 'zod'
import { MoneySchema } from '../primitives/money.js'
import {
  OrderSchema,
  PAYMENT_METHODS,
  ShippingAddressSchema,
  type PaymentMethod,
} from './order.contract.js'

/**
 * Tunnel d'achat — le côté ACHETEUR de la commande.
 *
 * `order.contract.ts` décrit ce que le vendeur fait d'une commande existante.
 * Celui-ci décrit comment elle naît, ce qui pose des contraintes différentes :
 * l'appelant n'est pas authentifié, il ne connaît aucun identifiant interne, et
 * la moitié de ce qu'il envoie ne doit surtout pas être crue sur parole.
 *
 * `ShippingAddressSchema` vit dans `order.contract` et non ici : la commande la
 * PORTE, le tunnel ne fait que la recueillir. L'y définir créerait un cycle
 * d'imports entre les deux fichiers.
 */

/** Méthodes dont la confirmation vient du téléphone de l'acheteur. */
export const MOBILE_MONEY_METHODS = ['mtn_momo', 'orange_money'] as const

export function requiresPayerPhone(method: PaymentMethod): boolean {
  return (MOBILE_MONEY_METHODS as readonly string[]).includes(method)
}

/**
 * Nombre maximal de lignes distinctes dans un panier.
 *
 * Borne explicite plutôt qu'illimitée : le service relit chaque produit en base
 * pour en prendre le prix, et une requête de dix mille lignes tiendrait la
 * connexion assez longtemps pour gêner tout le tenant.
 */
export const MAX_CART_LINES = 50

export const CheckoutSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          variantId: z.string().uuid().optional(),
          quantity: z.number().int().min(1).max(999),
        }),
      )
      .min(1)
      .max(MAX_CART_LINES),

    /*
     * AUCUN PRIX ICI, et c'est le point le plus important du fichier.
     *
     * Le panier vit dans le navigateur et affiche des montants, mais ces
     * montants ne servent qu'à l'affichage. Accepter un prix envoyé par le
     * client reviendrait à laisser l'acheteur fixer ce qu'il paie. Le serveur
     * relit chaque produit et recalcule tout ; si le total diffère de ce que
     * l'écran annonçait, c'est l'écran qui avait tort.
     */
    email: z.string().email('errors.checkout.invalidEmail'),
    paymentMethod: z.enum(PAYMENT_METHODS),
    /** Numéro qui recevra la demande de confirmation Mobile Money. */
    payerPhone: z
      .string()
      .min(8, 'errors.checkout.payerPhoneInvalid')
      .max(20, 'errors.checkout.payerPhoneInvalid')
      .optional(),
    shippingAddress: ShippingAddressSchema,
    /** doc/03 §6 — rejouer la requête ne doit pas créer deux commandes. */
    idempotencyKey: z.string().uuid(),
  })
  .superRefine((input, ctx) => {
    /*
     * La dépendance entre méthode et numéro est exprimée ICI plutôt que dans
     * le formulaire et dans le service. Écrite deux fois, elle finit par
     * diverger — et la version laxiste est toujours celle du serveur.
     */
    if (requiresPayerPhone(input.paymentMethod) && !input.payerPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payerPhone'],
        message: 'errors.checkout.payerPhoneRequired',
      })
    }
  })
export type CheckoutInput = z.infer<typeof CheckoutSchema>

/**
 * Ce que le client doit faire ENSUITE.
 *
 * Union discriminée plutôt qu'un `redirectUrl?` et un `expiresAt?` tous deux
 * optionnels : chaque méthode de paiement se termine autrement, et un objet
 * plat obligerait l'écran à deviner laquelle en testant quels champs sont
 * présents. Ajouter un prestataire ajoutera une branche, que le compilateur
 * signalera partout où elle manque.
 */
export const PaymentDirectiveSchema = z.discriminatedUnion('type', [
  /** Carte : le prestataire héberge le formulaire, on y envoie l'acheteur. */
  z.object({ type: z.literal('redirect'), url: z.string().url() }),
  /**
   * Mobile Money : rien à afficher, tout se passe sur le téléphone. L'écran
   * attend et interroge périodiquement l'état de la commande.
   */
  z.object({
    type: z.literal('awaitConfirmation'),
    expiresAt: z.string().datetime(),
    /** Numéro sollicité, réaffiché pour que l'acheteur sache où regarder. */
    payerPhone: z.string(),
  }),
  /** Virement : coordonnées à recopier, règlement hors ligne. */
  z.object({
    type: z.literal('instructions'),
    reference: z.string(),
    lines: z.array(z.string()),
  }),
])
export type PaymentDirective = z.infer<typeof PaymentDirectiveSchema>

export const CheckoutResultSchema = z.object({
  order: OrderSchema,
  next: PaymentDirectiveSchema,
  /**
   * Laissez-passer de consultation, remis une seule fois.
   *
   * L'acheteur invité n'a pas de session : sans lui, suivre sa commande
   * exigerait soit un endpoint ouvert par référence — donc énumérable, une
   * boutique laissant lire toutes ses ventes — soit un compte obligatoire.
   */
  trackingToken: z.string(),
})
export type CheckoutResult = z.infer<typeof CheckoutResultSchema>

/**
 * Vue PUBLIQUE d'une commande, pour le suivi côté acheteur.
 *
 * Volontairement plus pauvre que `OrderSchema` : ni commission plateforme, ni
 * identifiant client, ni marge. Le laissez-passer donne accès au suivi d'une
 * commande, pas aux comptes de la boutique.
 */
export const OrderTrackingSchema = z.object({
  reference: z.string(),
  status: OrderSchema.shape.status,
  paymentStatus: z.string().optional(),
  total: MoneySchema,
  createdAt: z.string().datetime(),
  /** Renseigné dès que le transporteur est connu — voir le chantier « suivi ». */
  trackingNumber: z.string().optional(),
})
export type OrderTracking = z.infer<typeof OrderTrackingSchema>
