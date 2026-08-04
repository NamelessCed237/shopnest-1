import { Injectable } from '@nestjs/common'
import {
  canTransition,
  REFUNDABLE_STATUSES,
  type ListOrdersQuery,
  type Order,
  type PaymentStatus,
  type RefundOrderInput,
  type UpdateOrderStatusInput,
} from '@shopnest/contracts'
import { AppException } from '../../common/errors/app.exception'
import { IdempotencyService } from '../../common/idempotency/idempotency.service'
import { OrdersRepository } from './orders.repository'

/**
 * doc/03 §2 — logique métier. Ne connaît ni HTTP, ni Prisma.
 *
 * Les transitions viennent de `ORDER_TRANSITIONS` (@shopnest/contracts) : la
 * même table que celle dont l'écran se sert pour décider quels boutons
 * afficher. L'interface ne peut donc pas proposer une transition que le serveur
 * refuserait — ni l'inverse.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly idempotency: IdempotencyService,
  ) {}

  list(query: ListOrdersQuery & { customerId?: string }) {
    return this.repo.list(query)
  }

  async detail(id: string): Promise<Order> {
    const order = await this.repo.findById(id)
    // 404 et non 403 pour une commande d'un autre tenant : un 403 confirmerait
    // son existence (doc/08 §3).
    if (!order) throw new AppException('NOT_FOUND', `order ${id} not found`)
    return order
  }

  async updateStatus(id: string, input: UpdateOrderStatusInput): Promise<Order> {
    return this.idempotency.run(`order.status:${id}`, input.idempotencyKey, async () => {
      const order = await this.detail(id)

      if (!canTransition(order.status, input.status)) {
        throw new AppException(
          'CONFLICT',
          `transition refused: ${order.status} → ${input.status}`,
          { userMessageKey: 'orders.errors.invalidTransition' },
        )
      }

      // Effets de bord sur le paiement. Ils ne sont pas cosmétiques : un écran
      // de détail affichant « payée » avec un paiement « en attente » ferait
      // douter le vendeur de ce qu'il a réellement encaissé.
      let paymentStatus: PaymentStatus | undefined
      if (input.status === 'paid') paymentStatus = 'settled'
      if (input.status === 'cancelled' && order.payment?.status === 'awaiting_confirmation') {
        paymentStatus = 'expired'
      }

      const updated = await this.repo.applyStatus(id, input.status, paymentStatus)
      if (!updated) throw new AppException('NOT_FOUND', `order ${id} not found`)
      return updated
    })
  }

  async refund(id: string, input: RefundOrderInput): Promise<Order> {
    return this.idempotency.run(`order.refund:${id}`, input.idempotencyKey, async () => {
      const order = await this.detail(id)

      if (!REFUNDABLE_STATUSES.includes(order.status)) {
        throw new AppException('CONFLICT', `status ${order.status} is not refundable`, {
          userMessageKey: 'orders.errors.notRefundable',
        })
      }

      // Plafond vérifié CÔTÉ SERVEUR, pas seulement dans le formulaire : sans
      // cela un client modifié rembourserait plus que le montant encaissé.
      const already = order.refundedAmount?.amountCents ?? 0
      const remaining = order.total.amountCents - already

      if (input.amountCents > remaining) {
        throw new AppException(
          'VALIDATION_FAILED',
          `refund ${input.amountCents} exceeds remaining ${remaining}`,
          {
            userMessageKey: 'orders.errors.refundTooLarge',
            fields: { amountCents: 'orders.errors.refundTooLarge' },
          },
        )
      }

      const total = already + input.amountCents

      // Le statut ne bascule qu'au remboursement INTÉGRAL : un remboursement
      // partiel laisse la commande dans son état — elle a bien été livrée, et
      // prétendre le contraire fausserait l'historique comme le chiffre
      // d'affaires.
      const updated = await this.repo.applyRefund(id, total, total >= order.total.amountCents)
      if (!updated) throw new AppException('NOT_FOUND', `order ${id} not found`)
      return updated
    })
  }
}
