import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { PaymentMethod } from '@shopnest/contracts'
import type {
  InitiatePaymentParams,
  InitiatedPayment,
  NormalizedWebhook,
  PaymentProvider,
} from './payment.provider'

/**
 * Prestataire SIMULÉ — développement et démonstration.
 *
 * Même raison d'être que le pilote de stockage local : sans lui, la moitié du
 * produit reste décorative tant qu'on n'a pas de compte MTN, de compte Orange
 * et de clés Stripe — trois démarches commerciales, pas trois variables
 * d'environnement.
 *
 * Il ne raccourcit RIEN. Il émet une vraie requête de webhook, signée, vers le
 * vrai endpoint, qui la déduplique dans la vraie table d'événements. Ce qui est
 * exercé en local est donc la chaîne réelle : le jour où l'on branche MTN, seul
 * ce fichier est remplacé.
 *
 * Il est refusé en staging et en production (`env.schema`) : un prestataire qui
 * confirme tout paiement sur simple demande n'a rien à faire près d'argent réel.
 */
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = 'simulator'
  readonly methods: readonly PaymentMethod[] = [
    'card',
    'mtn_momo',
    'orange_money',
    'bank_transfer',
  ]

  constructor(
    private readonly publicBaseUrl: string,
    private readonly signingSecret: string,
  ) {}

  /**
   * Délai de confirmation Mobile Money.
   *
   * Deux minutes, comme les vrais : c'est court, et c'est le point. Un tunnel
   * conçu contre un délai de dix secondes ne montre jamais l'écran d'attente
   * dans lequel l'acheteur passera le plus clair de son temps.
   */
  private static readonly CONFIRMATION_WINDOW_MS = 2 * 60_000

  initiate(params: InitiatePaymentParams): Promise<InitiatedPayment> {
    const externalId = `sim_${randomUUID()}`

    if (params.method === 'bank_transfer') {
      return Promise.resolve({
        externalId,
        // Le virement reste `pending` : personne ne peut confirmer une écriture
        // bancaire depuis un écran. C'est le vendeur qui l'encaissera à la main.
        status: 'pending',
        directive: {
          type: 'instructions',
          reference: params.reference,
          lines: [
            `Bénéficiaire : ShopNest (simulation)`,
            `IBAN : FR76 0000 0000 0000 0000 0000 000`,
            `Motif : ${params.reference}`,
          ],
        },
      })
    }

    if (params.method === 'card') {
      return Promise.resolve({
        externalId,
        status: 'pending',
        directive: {
          type: 'redirect',
          // Page de simulation servie par l'API : deux boutons, payer ou
          // échouer. C'est l'équivalent local d'une page Stripe hébergée.
          url: `${this.publicBaseUrl}/payments/simulator/${encodeURIComponent(params.correlationId)}?amount=${params.amount.amountCents}&currency=${params.amount.currency}&ref=${encodeURIComponent(params.reference)}`,
        },
      })
    }

    const expiresAt = new Date(Date.now() + SimulatedPaymentProvider.CONFIRMATION_WINDOW_MS)
    return Promise.resolve({
      externalId,
      status: 'awaiting_confirmation',
      expiresAt,
      directive: {
        type: 'awaitConfirmation',
        expiresAt: expiresAt.toISOString(),
        payerPhone: params.payerPhone ?? '',
      },
    })
  }

  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | undefined>,
  ): NormalizedWebhook | undefined {
    const signature = headers['x-shopnest-signature']
    if (!signature) return undefined

    const expected = createHmac('sha256', this.signingSecret).update(rawBody).digest('hex')
    const a = Buffer.from(expected)
    const b = Buffer.from(signature)
    // Comparaison à temps constant : une comparaison naïve laisse fuir, par le
    // temps de réponse, la longueur du préfixe correct.
    if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined

    const payload = JSON.parse(rawBody.toString('utf8')) as {
      eventId?: string
      correlationId?: string
      externalId?: string
      outcome?: string
      failureReason?: string
    }

    if (
      !payload.eventId ||
      !payload.correlationId ||
      !payload.externalId ||
      !isOutcome(payload.outcome)
    ) {
      return undefined
    }

    return {
      eventId: payload.eventId,
      correlationId: payload.correlationId,
      externalId: payload.externalId,
      outcome: payload.outcome,
      ...(payload.failureReason ? { failureReason: payload.failureReason } : {}),
    }
  }

  /** Signe un corps de webhook — utilisé par la page de simulation. */
  sign(rawBody: Buffer): string {
    return createHmac('sha256', this.signingSecret).update(rawBody).digest('hex')
  }
}

const OUTCOMES = ['settled', 'failed', 'expired'] as const

function isOutcome(value: unknown): value is (typeof OUTCOMES)[number] {
  return typeof value === 'string' && (OUTCOMES as readonly string[]).includes(value)
}
