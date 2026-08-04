import { randomBytes } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import {
  PLAN_LIMITS,
  requiresPayerPhone,
  type CheckoutInput,
  type CheckoutResult,
  type OrderTracking,
  type PaymentDirective,
} from '@shopnest/contracts'
import { AppException } from '../../common/errors/app.exception'
import { IdempotencyService } from '../../common/idempotency/idempotency.service'
import { TenantContext } from '../../tenancy/tenant-context'
import { PaymentsService } from '../payments/payments.service'
import { OutOfStockError, type SellableLine } from './checkout.repository'
import { CheckoutRepository } from './checkout.repository'

/**
 * Le tunnel d'achat, côté serveur.
 *
 * Règle unique dont tout le reste découle : RIEN de ce qui vient du client
 * n'est cru sur parole, sauf ce que lui seul peut savoir — son adresse, son
 * courriel, ce qu'il veut acheter et en quelle quantité. Les prix, les noms, la
 * disponibilité, les totaux et la commission sont relus ou recalculés ici.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name)

  constructor(
    private readonly repo: CheckoutRepository,
    private readonly payments: PaymentsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    /*
     * Idempotence AVANT toute écriture.
     *
     * C'est ici qu'elle compte le plus de tout le produit : sans elle, un
     * double-clic sur « Payer », ou une reprise réseau sur une connexion
     * mobile instable, crée deux commandes et sollicite deux fois le téléphone
     * de l'acheteur. Le rejeu renvoie la réponse d'origine — donc la même
     * commande et le même laissez-passer.
     */
    return this.idempotency.run('checkout', input.idempotencyKey, () => this.place(input))
  }

  private async place(input: CheckoutInput): Promise<CheckoutResult> {
    const store = TenantContext.get()
    const tenantId = TenantContext.getTenantIdOrThrow()

    const lines = await this.resolveLines(input)
    const currency = lines[0]!.currency

    const subtotalCents = lines.reduce(
      (sum, line) => sum + line.unitPriceCents * line.quantity,
      0,
    )

    /*
     * Livraison et taxe restent à ZÉRO, et c'est délibéré.
     *
     * Les colonnes existent et les montants circulent jusqu'à l'écran ; ce qui
     * manque, c'est une grille tarifaire par zone et un régime de TVA par pays.
     * Inventer un forfait ici reviendrait à afficher un prix de livraison que
     * le vendeur n'a pas fixé — et « livraison gratuite » est une promesse
     * commerciale, pas une valeur par défaut.
     */
    const shippingCents = 0
    const taxCents = 0
    const totalCents = subtotalCents + shippingCents + taxCents

    /*
     * Commission plateforme, calculée sur le TOTAL et à partir du plan.
     *
     * Le taux vient de `PLAN_LIMITS`, la même constante qui alimente la page
     * tarifs et l'écran de facturation : trois endroits qui doivent annoncer le
     * même pourcentage. Le plan `enterprise` a un taux négocié — donc `null` —
     * et tant qu'il n'est pas stocké par boutique, aucune commission n'est
     * prélevée. Facturer un taux inventé serait pire que ne rien facturer.
     */
    const rate = PLAN_LIMITS[store?.plan ?? 'basic'].transactionFeeRate
    const platformFeeCents = rate === null ? 0 : Math.round(totalCents * rate)

    const reference = await this.repo.nextReference()
    const correlationId = this.payments.newCorrelationId(tenantId)

    /*
     * Le client est retrouvé par son courriel, jamais créé ici.
     *
     * Créer un compte à l'insu de l'acheteur lui donnerait une fiche qu'il n'a
     * pas demandée, et un mot de passe qu'il n'a pas choisi. Une commande sans
     * `customerId` est parfaitement valide : c'est un achat en invité, et
     * `email` suffit à le recontacter.
     */
    const customer = await this.repo.findCustomerByEmail(input.email)

    const trackingToken = randomBytes(24).toString('base64url')

    let order
    try {
      order = await this.repo.placeOrder({
        tenantId,
        reference,
        // La commande naît `pending` : rien n'est encaissé. Elle passera à
        // `paid` quand le prestataire le confirmera, pas avant.
        status: 'pending',
        subtotalCents,
        shippingCents,
        taxCents,
        totalCents,
        platformFeeCents,
        currency,
        email: input.email,
        shippingAddress: input.shippingAddress,
        trackingToken,
        ...(customer ? { customerId: customer.id } : {}),
        lines,
        paymentMethod: input.paymentMethod,
        paymentStatus: 'pending',
        provider: this.payments.providerNameFor(input.paymentMethod),
        correlationId,
      })
    } catch (error) {
      if (error instanceof OutOfStockError) {
        throw new AppException('CONFLICT', error.message, {
          userMessageKey: 'errors.checkout.outOfStock',
          fields: { items: 'errors.checkout.outOfStock' },
        })
      }
      throw error
    }

    if (!order) throw new AppException('INTERNAL', 'order vanished right after creation')

    /*
     * Le paiement est déclenché APRÈS la création de la commande, jamais avant.
     *
     * L'ordre inverse serait plus direct — on connaîtrait le statut réel dès
     * l'insertion — et laisserait, en cas d'échec à l'écriture, le téléphone de
     * l'acheteur sonner pour une commande qui n'existe pas. Il n'aurait alors
     * aucune trace à opposer au vendeur. Une commande orpheline de paiement se
     * rattrape ; un débit orphelin de commande, non.
     */
    const directive = await this.payments.initiate({
      correlationId,
      reference,
      amount: { amountCents: totalCents, currency },
      method: input.paymentMethod,
      ...(input.payerPhone ? { payerPhone: input.payerPhone } : {}),
      orderId: order.id,
    })

    this.logger.log(`commande ${reference} créée — ${totalCents} ${currency} en ${input.paymentMethod}`)

    /*
     * La commande est RELUE après l'initiation.
     *
     * `placeOrder` la renvoie telle qu'elle était à l'insertion, donc avec un
     * paiement `pending` — état déjà périmé quand l'initiation l'a fait passer
     * à `awaiting_confirmation`. Le corps annonçait alors « en attente » à côté
     * d'une directive « attendez la confirmation sur votre téléphone » : deux
     * informations contradictoires dans la même réponse, et l'écran qui se fie
     * au statut n'aurait jamais montré le compte à rebours.
     */
    const settled = await this.repo.findById(order.id)

    return { order: settled ?? order, next: directive as PaymentDirective, trackingToken }
  }

  /**
   * Traduit le panier en lignes vendables, ou refuse.
   *
   * Chaque refus est explicite et distinct : « ce produit n'est plus au
   * catalogue » et « ce produit se commande par déclinaison » appellent deux
   * corrections différentes de l'acheteur, et un message unique
   * « panier invalide » le laisserait chercher.
   */
  private async resolveLines(input: CheckoutInput): Promise<SellableLine[]> {
    if (requiresPayerPhone(input.paymentMethod) && !input.payerPhone) {
      // Déjà refusé par le schéma ; répété ici parce que ce service peut être
      // appelé par un autre chemin un jour, et que la règle est trop coûteuse
      // à manquer — une demande Mobile Money sans numéro part dans le vide.
      throw new AppException('VALIDATION_FAILED', 'payer phone required', {
        userMessageKey: 'errors.checkout.payerPhoneRequired',
      })
    }

    const catalog = await this.repo.loadSellables(input.items)
    const lines: SellableLine[] = []

    for (const item of input.items) {
      const key = item.variantId ? `${item.productId}:${item.variantId}` : item.productId
      const sellable = catalog.get(key)

      if (!sellable) {
        throw new AppException('CONFLICT', `not sellable: ${key}`, {
          userMessageKey: 'errors.checkout.unavailable',
        })
      }

      // Un produit à variantes n'a pas de stock propre : le contrat dit que le
      // sien est la SOMME de ses déclinaisons. Le commander tel quel
      // décrémenterait un compteur dérivé, donc rien du tout.
      if (sellable.hasVariants) {
        throw new AppException('CONFLICT', `variant required for ${item.productId}`, {
          userMessageKey: 'errors.checkout.variantRequired',
        })
      }

      lines.push({ ...sellable, quantity: item.quantity })
    }

    /*
     * Une commande porte UNE devise.
     *
     * `Money` interdit déjà d'additionner deux devises, et l'addition se ferait
     * ici. Le cas ne peut survenir que si une boutique a mélangé les devises de
     * ses produits : mieux vaut refuser la vente que facturer un total dont
     * personne ne sait dans quelle monnaie il est.
     */
    const currencies = new Set(lines.map((line) => line.currency))
    if (currencies.size > 1) {
      throw new AppException('CONFLICT', `mixed currencies: ${[...currencies].join(', ')}`, {
        userMessageKey: 'errors.checkout.mixedCurrencies',
      })
    }

    return lines
  }

  /**
   * Suivi d'une commande par laissez-passer.
   *
   * Renvoie 404 pour un jeton inconnu — jamais 403 : distinguer les deux
   * confirmerait qu'un jeton existe, et transformerait cet endpoint en oracle.
   */
  async track(token: string): Promise<OrderTracking> {
    const row = await this.repo.findByTrackingToken(token)
    if (!row) throw new AppException('NOT_FOUND', 'unknown tracking token')

    return {
      reference: row.reference,
      status: row.status as OrderTracking['status'],
      ...(row.payment_status ? { paymentStatus: row.payment_status } : {}),
      total: { amountCents: row.total_cents, currency: row.currency },
      createdAt: row.created_at.toISOString(),
    }
  }
}
