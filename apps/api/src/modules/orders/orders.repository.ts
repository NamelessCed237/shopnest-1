import { Injectable } from '@nestjs/common'
import type { ListOrdersQuery, OrderStatus, PaymentStatus } from '@shopnest/contracts'
import { PrismaService } from '../../database/prisma.service'
import { toOrder } from './orders.mapper'

/** Tout ce que le mapper attend d'une commande, en une seule requête. */
const FULL_ORDER = {
  items: true,
  // `createdAt asc` : le mapper expose le DERNIER paiement comme état courant.
  payments: { orderBy: { createdAt: 'asc' } },
  // Jointure ciblée plutôt qu'une requête par ligne : la liste affiche le nom
  // de l'acheteur sur chaque commande (doc/02 §2.3 — pas de N+1).
  customer: { select: { firstName: true, lastName: true, email: true } },
} as const

/**
 * doc/03 §2 — LE SEUL endroit où Prisma apparaît pour ce domaine.
 */
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.withTenantIsolation()
  }

  async findById(id: string) {
    const row = await this.db.order.findFirst({ where: { id }, include: FULL_ORDER })
    return row ? toOrder(row) : null
  }

  /** doc/02 §2.3 — pagination par curseur, jamais par offset. */
  async list(query: ListOrdersQuery & { customerId?: string }) {
    const rows = await this.db.order.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.paymentMethod ? { payments: { some: { method: query.paymentMethod } } } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
        // La recherche porte sur la RÉFÉRENCE et sur l'acheteur. Chercher « Awa »
        // doit trouver ses commandes : c'est ainsi qu'on cherche une commande au
        // téléphone, pas par un numéro qu'on n'a pas sous les yeux.
        ...(query.search
          ? {
              OR: [
                { reference: { contains: query.search, mode: 'insensitive' as const } },
                {
                  customer: {
                    is: {
                      OR: [
                        { firstName: { contains: query.search, mode: 'insensitive' as const } },
                        { lastName: { contains: query.search, mode: 'insensitive' as const } },
                        { email: { contains: query.search, mode: 'insensitive' as const } },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: FULL_ORDER,
    })

    const hasNext = rows.length > query.limit
    const page = hasNext ? rows.slice(0, query.limit) : rows
    return { items: page.map(toOrder), nextCursor: hasNext ? page.at(-1)?.id : undefined }
  }

  /**
   * Applique la transition ET les effets de bord sur le paiement, en UNE
   * transaction : une commande passée à `paid` dont le paiement resterait
   * `pending` mentirait à l'écran de détail.
   */
  async applyStatus(id: string, status: OrderStatus, paymentStatus?: PaymentStatus) {
    // `updateMany` et non `update` pour la commande : sous RLS, viser la ligne
    // d'un autre vendeur doit ne rien faire, pas lever un « record not found »
    // qui confirmerait son existence (doc/08 §3).
    await this.prisma.runInTenantTransaction(async (tx) => {
      await tx.order.updateMany({ where: { id }, data: { status } })
      if (paymentStatus) {
        await tx.payment.updateMany({ where: { orderId: id }, data: { status: paymentStatus } })
      }
    })
    return this.findById(id)
  }

  async applyRefund(id: string, refundedCents: number, terminal: boolean) {
    await this.prisma.runInTenantTransaction(async (tx) => {
      await tx.order.updateMany({
        where: { id },
        data: { refundedCents, ...(terminal ? { status: 'refunded' } : {}) },
      })
      if (terminal) {
        await tx.payment.updateMany({ where: { orderId: id }, data: { status: 'refunded' } })
      }
    })
    return this.findById(id)
  }

  countByStatus(status: OrderStatus) {
    return this.db.order.count({ where: { status } })
  }
}
