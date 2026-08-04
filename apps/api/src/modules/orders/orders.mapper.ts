import { ShippingAddressSchema } from '@shopnest/contracts'
import type {
  Money,
  Order,
  OrderItem,
  Payment,
  PaymentMethod,
  PaymentStatus,
  ShippingAddress,
} from '@shopnest/contracts'

/**
 * Ligne Prisma → contrat. Même rôle que `products.mapper` : la base stocke des
 * entiers de centimes à plat, le contrat expose des objets `Money` où le montant
 * ne circule jamais sans sa devise.
 */

interface ItemRow {
  id: string
  productId: string
  variantId: string | null
  productName: string
  unitPriceCents: number
  quantity: number
  lineTotalCents: number
}

interface PaymentRow {
  id: string
  method: string
  status: string
  amountCents: number
  currency: string
  provider: string
  externalId: string | null
  expiresAt: Date | null
}

interface OrderRow {
  id: string
  reference: string
  customerId: string | null
  status: string
  subtotalCents: number
  shippingCents: number
  taxCents: number
  discountCents: number
  totalCents: number
  platformFeeCents: number
  refundedCents: number
  currency: string
  shippingAddress?: unknown
  email?: string | null
  createdAt: Date
  items?: ItemRow[]
  payments?: PaymentRow[]
  customer?: { firstName: string | null; lastName: string | null; email: string } | null
}

/**
 * Nom d'affichage : prénom + nom, à défaut l'email.
 *
 * Un acheteur peut avoir commandé en invité sans donner son nom ; afficher son
 * email vaut mieux qu'une ligne vide, qui laisse croire à une donnée manquante.
 */
function displayName(customer: NonNullable<OrderRow['customer']>): string {
  const full = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
  return full || customer.email
}

const money = (amountCents: number, currency: string): Money => ({ amountCents, currency })

export function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    reference: row.reference,
    ...(row.customerId ? { customerId: row.customerId } : {}),
    ...(row.customer ? { customerName: displayName(row.customer) } : {}),
    status: row.status as Order['status'],
    items: (row.items ?? []).map((item) => toOrderItem(item, row.currency)),
    subtotal: money(row.subtotalCents, row.currency),
    shipping: money(row.shippingCents, row.currency),
    tax: money(row.taxCents, row.currency),
    discount: money(row.discountCents, row.currency),
    total: money(row.totalCents, row.currency),
    platformFee: money(row.platformFeeCents, row.currency),
    // Absent tant qu'aucun remboursement n'a eu lieu : le contrat le déclare
    // optionnel précisément pour que l'interface distingue « pas de
    // remboursement » de « remboursement de 0 », qui n'existe pas.
    ...(row.refundedCents > 0 ? { refundedAmount: money(row.refundedCents, row.currency) } : {}),
    // La commande n'a qu'un paiement côté contrat. En base la table en accepte
    // plusieurs (une tentative Mobile Money échouée puis une réussie) : on
    // expose la DERNIÈRE, seule pertinente pour l'état courant.
    ...(row.payments?.length ? { payment: toPayment(row.payments[row.payments.length - 1]!) } : {}),
    /*
     * L'adresse est validée à la SORTIE et non recopiée telle quelle.
     *
     * C'est une colonne JSON : PostgreSQL n'en garantit pas la forme, et une
     * commande écrite par une version antérieure du service — ou par un import —
     * peut ne pas correspondre au contrat d'aujourd'hui. La renvoyer sans
     * contrôle ferait tomber l'écran du vendeur sur un champ manquant, loin
     * d'ici. On préfère l'omettre : le détail de commande sait déjà dire
     * « adresse absente ».
     */
    ...parseShippingAddress(row.shippingAddress),
    ...(row.email ? { email: row.email } : {}),
    createdAt: row.createdAt.toISOString(),
  }
}

function parseShippingAddress(raw: unknown): { shippingAddress?: ShippingAddress } {
  if (!raw) return {}
  const parsed = ShippingAddressSchema.safeParse(raw)
  return parsed.success ? { shippingAddress: parsed.data } : {}
}

function toOrderItem(row: ItemRow, currency: string): OrderItem {
  return {
    id: row.id,
    productId: row.productId,
    ...(row.variantId ? { variantId: row.variantId } : {}),
    productName: row.productName,
    unitPrice: money(row.unitPriceCents, currency),
    quantity: row.quantity,
    lineTotal: money(row.lineTotalCents, currency),
  }
}

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    method: row.method as PaymentMethod,
    status: row.status as PaymentStatus,
    amount: money(row.amountCents, row.currency),
    provider: row.provider,
    ...(row.externalId ? { externalId: row.externalId } : {}),
    ...(row.expiresAt ? { expiresAt: row.expiresAt.toISOString() } : {}),
  }
}
