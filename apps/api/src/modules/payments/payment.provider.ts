import { randomUUID } from 'node:crypto'
import type { Money, PaymentDirective, PaymentMethod, PaymentStatus } from '@shopnest/contracts'

/**
 * Contrat d'un prestataire de paiement.
 *
 * Deux opérations seulement, parce qu'un paiement n'a que deux moments : on le
 * déclenche, et on apprend plus tard ce qu'il est devenu. Tout le reste — forme
 * de la signature, vocabulaire des statuts, nom des champs — est enfermé
 * derrière ces deux méthodes.
 *
 * L'asynchronisme n'est PAS un cas particulier ici, c'est le cas normal. Mobile
 * Money demande une validation sur le téléphone de l'acheteur : entre l'appel
 * et la réponse, il peut s'écouler deux minutes, ou rien du tout si l'acheteur
 * laisse expirer. Un modèle « appelle et attends la réponse » ne décrit
 * simplement pas ce qui se passe.
 */
export interface PaymentProvider {
  readonly name: string
  /** Moyens que ce prestataire sait traiter. */
  readonly methods: readonly PaymentMethod[]

  initiate(params: InitiatePaymentParams): Promise<InitiatedPayment>

  /**
   * Vérifie la signature et traduit l'événement.
   *
   * Renvoie `undefined` si la signature ne correspond pas — et NON une
   * exception : l'endpoint de webhook est ouvert sur Internet, et distinguer
   * dans la réponse « signature invalide » de « paiement inconnu » indiquerait
   * à un attaquant lequel de ses deux essais était le bon.
   */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | undefined>): NormalizedWebhook | undefined
}

export interface InitiatePaymentParams {
  /** Corrélation, à faire écho par le prestataire — voir `buildCorrelationId`. */
  correlationId: string
  reference: string
  amount: Money
  method: PaymentMethod
  /** Renseigné pour Mobile Money uniquement. */
  payerPhone?: string
  /** Où renvoyer l'acheteur après un paiement par carte. */
  returnUrl: string
}

export interface InitiatedPayment {
  /** Identifiant du paiement CHEZ le prestataire. */
  externalId: string
  status: PaymentStatus
  expiresAt?: Date
  /** Ce que le navigateur doit faire ensuite. */
  directive: PaymentDirective
}

export interface NormalizedWebhook {
  /**
   * Identifiant de l'ÉVÉNEMENT, pas du paiement.
   *
   * Un même paiement en produit plusieurs — « pris en compte », puis
   * « confirmé ». Dédupliquer sur l'identifiant du paiement ferait ignorer le
   * second, donc perdre la confirmation qui compte.
   */
  eventId: string
  correlationId: string
  externalId: string
  outcome: 'settled' | 'failed' | 'expired'
  /** Texte du prestataire, repris tel quel pour l'acheteur. */
  failureReason?: string
}

export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS')

/**
 * Corrélation tenant ↔ paiement, portée par l'identifiant lui-même.
 *
 * Un webhook arrive sans session, sans en-tête de tenant et sans sous-domaine :
 * il n'a aucun contexte. Or `payments` est protégée par la RLS — chercher le
 * paiement sans savoir à quelle boutique il appartient ne renvoie rien, en
 * silence. C'est exactement le piège déjà rencontré sur les statistiques.
 *
 * Plutôt qu'une table de correspondance globale — donc une seconde source de
 * vérité à garder synchronisée — l'identifiant TRANSPORTE le tenant. Les trois
 * prestataires visés le permettent : MTN MoMo laisse fixer `X-Reference-Id`,
 * Orange Money accepte une référence marchand, Stripe des `metadata`.
 *
 * Le tenantId n'est pas un secret : il figure déjà dans les URL publiques des
 * images produit. Ce qu'il faut protéger, c'est l'écriture — et elle reste
 * gardée par la signature du webhook.
 */
export function buildCorrelationId(tenantId: string): string {
  return `${tenantId}.${randomUUID()}`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Extrait le tenant d'une corrélation. `undefined` si la forme ne colle pas. */
export function tenantFromCorrelationId(correlationId: string): string | undefined {
  const [tenantId] = correlationId.split('.')
  return tenantId && UUID_RE.test(tenantId) ? tenantId : undefined
}
