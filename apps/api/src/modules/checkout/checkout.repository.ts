import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { CheckoutInput, PaymentMethod, PaymentStatus } from '@shopnest/contracts'
import { PrismaService } from '../../database/prisma.service'
import { toOrder } from '../orders/orders.mapper'

/**
 * Rupture de stock détectée À L'INTÉRIEUR de la transaction.
 *
 * Une erreur dédiée et non une `AppException` : celle-ci traverse Prisma pour
 * provoquer l'annulation, et le service la retraduit ensuite en message
 * utilisateur. Lever directement l'exception HTTP ici mêlerait la couche
 * données à la couche présentation — et surtout, on ne saurait plus à la
 * lecture que son rôle premier est d'annuler la transaction.
 */
export class OutOfStockError extends Error {
  constructor(readonly productName: string) {
    super(`out of stock: ${productName}`)
    this.name = 'OutOfStockError'
  }
}

/** Ce que le tunnel doit savoir d'un article avant de le vendre. */
export interface SellableLine {
  productId: string
  variantId?: string
  name: string
  unitPriceCents: number
  currency: string
  quantity: number
  /** Vrai si le produit a des variantes : il n'est alors pas vendable tel quel. */
  hasVariants: boolean
}

@Injectable()
export class CheckoutRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.withTenantIsolation()
  }

  /**
   * Relit les articles du panier EN BASE.
   *
   * Le panier vit dans le navigateur : son contenu est une intention, pas un
   * fait. Prix, nom et disponibilité viennent tous d'ici. Un panier qui
   * annonce 1 000 F pour un article à 87 000 F sera facturé 87 000.
   */
  async loadSellables(
    lines: CheckoutInput['items'],
  ): Promise<Map<string, Omit<SellableLine, 'quantity'>>> {
    const productIds = [...new Set(lines.map((line) => line.productId))]

    const products = await this.db.product.findMany({
      // `status: 'active'` : ni brouillon ni archivé. Un produit retiré du
      // catalogue reste accessible par son identifiant — le panier a pu être
      // rempli avant le retrait, et l'onglet rester ouvert des heures.
      where: { id: { in: productIds }, status: 'active', deletedAt: null },
      select: {
        id: true,
        name: true,
        priceCents: true,
        currency: true,
        variants: { select: { id: true, name: true, priceCents: true } },
      },
    })

    const catalog = new Map<string, Omit<SellableLine, 'quantity'>>()
    for (const product of products) {
      catalog.set(product.id, {
        productId: product.id,
        name: product.name,
        unitPriceCents: product.priceCents,
        currency: product.currency,
        hasVariants: product.variants.length > 0,
      })

      for (const variant of product.variants) {
        // Clé composée : une variante se commande par le couple produit +
        // variante, et deux produits peuvent avoir une variante « Noir / M ».
        catalog.set(`${product.id}:${variant.id}`, {
          productId: product.id,
          variantId: variant.id,
          name: `${product.name} — ${variant.name}`,
          unitPriceCents: variant.priceCents,
          currency: product.currency,
          hasVariants: false,
        })
      }
    }

    return catalog
  }

  /**
   * Référence lisible, unique par boutique.
   *
   * Un UUID ferait l'affaire techniquement et serait illisible au téléphone :
   * « ma commande C-M-D tiret 2 6 0 1 » se dicte, `f47ac10b-…` non. La
   * séquence est comptée PAR BOUTIQUE, sinon un vendeur déduirait le volume de
   * ses concurrents de l'écart entre deux de ses propres numéros.
   */
  async nextReference(): Promise<string> {
    const rows = await this.prisma.queryRawScoped<{ count: bigint }[]>(
      Prisma.sql`SELECT COUNT(*) AS count FROM orders`,
    )
    const count = Number(rows[0]?.count ?? 0)
    return `CMD-${String(2601 + count).padStart(5, '0')}`
  }

  /**
   * Réserve le stock ET crée la commande, ses lignes et son paiement — en UNE
   * transaction.
   *
   * Le regroupement n'est pas une commodité, c'est la correction même de
   * l'opération. Trois écritures qui ne veulent rien dire séparément : une
   * commande sans lignes est un total sans contenu, un paiement sans commande
   * un montant sans destinataire, et un stock décrémenté sans commande est de
   * la marchandise qui disparaît de l'inventaire sans être vendue.
   *
   * La réservation en fait partie pour la même raison. Réserver d'abord, créer
   * ensuite, imposerait de RENDRE le stock si la création échoue — une écriture
   * de compensation, qui échoue à son tour un jour sur mille et laisse un
   * inventaire faux que personne ne saura expliquer. Ici, un échec à
   * n'importe quel point annule tout.
   */
  async placeOrder(input: CreateOrderRow) {
    const orderId = await this.prisma.runInTenantTransaction(async (tx) => {
      for (const line of input.lines) {
        /*
         * `UPDATE … WHERE stock >= quantité` plutôt que « lire, comparer,
         * écrire » : entre la lecture et l'écriture, une autre commande peut
         * vider le stock. Le dernier article part alors deux fois, et l'un des
         * deux acheteurs recevra un appel gêné. Ici la comparaison et la
         * soustraction sont la même instruction — c'est la base qui tranche.
         *
         * `status = 'active'` est revérifié au moment de l'écriture : le
         * produit était vendable à la lecture, il a pu être archivé depuis.
         */
        const reserved = line.variantId
          ? await tx.$executeRaw`
              UPDATE product_variants
                 SET stock = stock - ${line.quantity}
               WHERE id = ${line.variantId}::uuid AND stock >= ${line.quantity}`
          : await tx.$executeRaw`
              UPDATE products
                 SET stock = stock - ${line.quantity}
               WHERE id = ${line.productId}::uuid
                 AND status = 'active'
                 AND deleted_at IS NULL
                 AND stock >= ${line.quantity}`

        if (reserved === 0) throw new OutOfStockError(line.name)
      }

      const order = await tx.order.create({
        data: {
          tenantId: input.tenantId,
          reference: input.reference,
          status: input.status,
          subtotalCents: input.subtotalCents,
          shippingCents: input.shippingCents,
          taxCents: input.taxCents,
          discountCents: 0,
          totalCents: input.totalCents,
          platformFeeCents: input.platformFeeCents,
          currency: input.currency,
          email: input.email,
          shippingAddress: input.shippingAddress as Prisma.InputJsonValue,
          trackingToken: input.trackingToken,
          ...(input.customerId ? { customerId: input.customerId } : {}),
          items: {
            create: input.lines.map((line) => ({
              tenantId: input.tenantId,
              productId: line.productId,
              variantId: line.variantId ?? null,
              // Instantané : renommer le produit demain ne doit pas réécrire
              // ce que l'acheteur a commandé aujourd'hui.
              productName: line.name,
              unitPriceCents: line.unitPriceCents,
              quantity: line.quantity,
              lineTotalCents: line.unitPriceCents * line.quantity,
            })),
          },
        },
        select: { id: true },
      })

      await tx.payment.create({
        data: {
          tenantId: input.tenantId,
          orderId: order.id,
          method: input.paymentMethod,
          status: input.paymentStatus,
          amountCents: input.totalCents,
          currency: input.currency,
          provider: input.provider,
          externalId: input.correlationId,
          expiresAt: input.expiresAt ?? null,
        },
      })

      return order.id
    })

    return this.findById(orderId)
  }

  async findById(id: string) {
    const row = await this.db.order.findFirst({
      where: { id },
      include: { items: true, payments: { orderBy: { createdAt: 'asc' } } },
    })
    return row ? toOrder(row) : null
  }

  /**
   * Retrouve une commande par son laissez-passer de suivi.
   *
   * `queryRawScoped` et NON `$queryRaw`. Écrite avec ce dernier, la requête
   * renvoyait systématiquement zéro ligne : `$queryRaw` court-circuite
   * l'extension d'isolation, donc personne ne positionne `app.tenant_id`, et la
   * RLS refuse tout — sans erreur, sans trace. C'est exactement le piège déjà
   * documenté dans `PrismaService`, et il se referme à chaque fois qu'on écrit
   * du SQL brut en pensant à autre chose.
   *
   * Le contexte est disponible ici : la page de suivi est servie par la
   * boutique, donc sous son sous-domaine. Le jeton reste malgré tout unique à
   * l'échelle de la base — le filtre par tenant s'ajoute à lui, il ne le
   * remplace pas.
   */
  async findByTrackingToken(token: string) {
    const rows = await this.prisma.queryRawScoped<TrackingRow[]>(Prisma.sql`
      SELECT o.reference, o.status, o.total_cents, o.currency, o.created_at,
             (SELECT p.status FROM payments p
               WHERE p.order_id = o.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status
        FROM orders o
       WHERE o.tracking_token = ${token}
       LIMIT 1`)
    return rows[0]
  }

  /** Rattache la commande à un client existant, s'il y en a un pour ce courriel. */
  findCustomerByEmail(email: string) {
    return this.db.customer.findFirst({ where: { email }, select: { id: true } })
  }
}

export interface CreateOrderRow {
  tenantId: string
  reference: string
  status: string
  subtotalCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
  platformFeeCents: number
  currency: string
  email: string
  shippingAddress: unknown
  trackingToken: string
  customerId?: string
  lines: SellableLine[]
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  provider: string
  correlationId: string
  expiresAt?: Date
}

interface TrackingRow {
  reference: string
  status: string
  total_cents: number
  currency: string
  created_at: Date
  payment_status: string | null
}
