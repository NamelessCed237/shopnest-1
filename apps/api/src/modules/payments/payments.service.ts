import { Inject, Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { Money, PaymentDirective, PaymentMethod } from '@shopnest/contracts'
import { AppException } from '../../common/errors/app.exception'
import { PrismaService } from '../../database/prisma.service'
import {
  PAYMENT_PROVIDERS,
  buildCorrelationId,
  tenantFromCorrelationId,
  type NormalizedWebhook,
  type PaymentProvider,
} from './payment.provider'

export interface InitiateRequest {
  correlationId: string
  reference: string
  amount: Money
  method: PaymentMethod
  payerPhone?: string
  orderId: string
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    @Inject(PAYMENT_PROVIDERS) private readonly providers: readonly PaymentProvider[],
    private readonly prisma: PrismaService,
    @Inject('PAYMENT_RETURN_URL') private readonly returnUrl: string,
  ) {}

  newCorrelationId(tenantId: string): string {
    return buildCorrelationId(tenantId)
  }

  providerNameFor(method: PaymentMethod): string {
    return this.providerFor(method).name
  }

  /**
   * Déclenche le paiement et met le compte rendu du prestataire dans la ligne
   * `payments` déjà créée par le tunnel.
   *
   * Le statut de départ vaut `pending` ; c'est ici qu'il devient
   * `awaiting_confirmation` pour Mobile Money, ou reste `pending` le temps que
   * l'acheteur remplisse un formulaire de carte.
   */
  async initiate(request: InitiateRequest): Promise<PaymentDirective> {
    const provider = this.providerFor(request.method)

    let initiated
    try {
      initiated = await provider.initiate({
        correlationId: request.correlationId,
        reference: request.reference,
        amount: request.amount,
        method: request.method,
        ...(request.payerPhone ? { payerPhone: request.payerPhone } : {}),
        returnUrl: this.returnUrl,
      })
    } catch (error) {
      /*
       * Le prestataire est injoignable ou refuse. La commande EXISTE déjà — on
       * la laisse, avec un paiement marqué en échec plutôt qu'un paiement
       * bloqué à `pending` que personne ne relancerait jamais. L'acheteur voit
       * un échec, le vendeur voit une commande impayée : deux informations
       * exactes, là où un silence aurait produit une commande fantôme.
       */
      this.logger.error(`initiation refusée par ${provider.name} : ${String(error)}`)
      await this.markFailed(request.correlationId, 'provider unreachable')
      throw new AppException('INTERNAL', 'payment initiation failed', {
        userMessageKey: 'errors.checkout.paymentFailed',
      })
    }

    await this.prisma.executeRawScoped(Prisma.sql`
      UPDATE payments
         SET status = ${initiated.status},
             expires_at = ${initiated.expiresAt ?? null},
             updated_at = NOW()
       WHERE external_id = ${request.correlationId}`)

    return initiated.directive
  }

  /**
   * Traite un événement de webhook.
   *
   * Trois choses arrivent ici, dans cet ordre strict : on VÉRIFIE la signature,
   * on DÉDUPLIQUE, puis seulement on applique. Inverser deux d'entre elles
   * suffit à ouvrir une faille — dédupliquer avant de vérifier laisserait un
   * inconnu neutraliser un vrai événement en devinant son identifiant.
   */
  async handleWebhook(
    providerName: string,
    rawBody: Buffer,
    headers: Record<string, string | undefined>,
  ): Promise<{ status: 'applied' | 'duplicate' }> {
    const provider = this.providers.find((candidate) => candidate.name === providerName)
    if (!provider) throw new AppException('NOT_FOUND', `unknown provider ${providerName}`)

    const event = provider.parseWebhook(rawBody, headers)
    if (!event) {
      /*
       * Signature invalide OU corps illisible : une seule et même réponse.
       *
       * Les distinguer indiquerait à un attaquant laquelle de ses deux
       * hypothèses était la bonne — et c'est exactement l'information qui
       * permet de progresser à tâtons vers une signature valide.
       */
      throw new AppException('FORBIDDEN', 'webhook rejected')
    }

    const tenantId = tenantFromCorrelationId(event.correlationId)
    if (!tenantId) throw new AppException('FORBIDDEN', 'webhook rejected')

    /*
     * Déduplication AVANT application, dans une table GLOBALE.
     *
     * Tous les prestataires réémettent : c'est leur façon de garantir la
     * livraison, et elle suppose que le destinataire sache ignorer un doublon.
     * Sans cela, une confirmation reçue deux fois passerait deux fois la
     * commande à `paid` — anodin — mais le même mécanisme appliqué demain à un
     * remboursement rendrait l'argent deux fois.
     *
     * L'unicité est portée par un index, pas par une lecture préalable : deux
     * copies arrivant en même temps passeraient toutes deux le test de lecture.
     */
    try {
      await this.prisma.webhookEvent.create({
        data: { provider: providerName, externalId: event.eventId, payload: {} },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.log(`événement ${event.eventId} déjà traité — ignoré`)
        return { status: 'duplicate' }
      }
      throw error
    }

    await this.apply(tenantId, event)

    await this.prisma.webhookEvent.updateMany({
      where: { provider: providerName, externalId: event.eventId },
      data: { processedAt: new Date() },
    })

    return { status: 'applied' }
  }

  /**
   * Applique l'issue au paiement ET à la commande, en une transaction.
   *
   * Le contexte tenant vient de la corrélation, pas d'une session : un webhook
   * arrive sans en-tête, sans sous-domaine et sans jeton. Sans ce contexte, la
   * RLS filtrerait tout et la mise à jour ne toucherait aucune ligne — en
   * silence, ce qui est le pire des cas : le prestataire recevrait un 200 et
   * ne réessaierait jamais.
   */
  private async apply(tenantId: string, event: NormalizedWebhook): Promise<void> {
    const orderStatus = ORDER_STATUS_FOR[event.outcome]
    const paymentStatus = PAYMENT_STATUS_FOR[event.outcome]

    const affected = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', '${tenantId}', true)`,
      )

      const updated = await tx.$executeRaw`
        UPDATE payments
           SET status = ${paymentStatus},
               failure_reason = ${event.failureReason ?? null},
               updated_at = NOW()
         WHERE external_id = ${event.correlationId}`

      if (updated === 0) return 0

      /*
       * La commande ne suit QUE si elle est encore en attente.
       *
       * Un vendeur a pu l'annuler entre-temps, ou l'avoir déjà marquée payée à
       * la main après un appel de l'acheteur. Écraser son geste par un
       * événement arrivé avec dix minutes de retard lui ferait perdre
       * confiance dans son propre écran.
       */
      return tx.$executeRaw`
        UPDATE orders
           SET status = ${orderStatus}, updated_at = NOW()
         WHERE id = (SELECT order_id FROM payments WHERE external_id = ${event.correlationId})
           AND status IN ('pending', 'awaiting_payment')`
    })

    if (affected === 0) {
      // Paiement introuvable : corrélation forgée, ou base repartie de zéro.
      // On journalise et on s'arrête — inutile de faire réessayer le
      // prestataire pour un paiement qui n'existe pas.
      this.logger.warn(`aucun paiement pour la corrélation ${event.correlationId}`)
    }
  }

  private async markFailed(correlationId: string, reason: string): Promise<void> {
    await this.prisma.executeRawScoped(Prisma.sql`
      UPDATE payments
         SET status = 'failed', failure_reason = ${reason}, updated_at = NOW()
       WHERE external_id = ${correlationId}`)
  }

  private providerFor(method: PaymentMethod): PaymentProvider {
    const provider = this.providers.find((candidate) => candidate.methods.includes(method))
    if (!provider) {
      throw new AppException('VALIDATION_FAILED', `no provider for ${method}`, {
        userMessageKey: 'errors.checkout.methodUnavailable',
      })
    }
    return provider
  }
}

/**
 * Traduction issue → statuts, en UN seul endroit.
 *
 * Dispersée en `if`, elle finirait par diverger entre le webhook, la relance
 * manuelle et l'expiration automatique — et une commande resterait « payée »
 * avec un paiement « expiré ».
 */
const ORDER_STATUS_FOR = {
  settled: 'paid',
  failed: 'payment_failed',
  expired: 'payment_failed',
} as const

const PAYMENT_STATUS_FOR = {
  settled: 'settled',
  failed: 'failed',
  expired: 'expired',
} as const
