import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService, tenantScoped } from '../../database/prisma.service'

/**
 * doc/03 §6 — idempotence des mutations déclenchées par le CLIENT.
 *
 * `webhook_events` protège des rejeux du prestataire de paiement. Celle-ci
 * protège des rejeux du navigateur : double-clic sur « Marquer comme expédiée »,
 * bouton « réessayer » après une coupure, nouvelle tentative automatique d'un
 * client mobile. Sans elle, deux transitions s'appliquent — ou deux
 * remboursements partent.
 *
 * La RÉPONSE est mémorisée, pas seulement la clé : un rejeu renvoie exactement
 * le même corps que l'appel initial. Répondre « déjà traité » obligerait chaque
 * client à gérer un second cas, et le premier appelant à conserver un résultat
 * qu'il a peut-être perdu en route — c'est précisément la situation qui l'a
 * poussé à réessayer.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.withTenantIsolation()
  }

  /**
   * `scope` sépare les opérations : la même clé sur deux endpoints reste deux
   * intentions distinctes, et les confondre ferait renvoyer à un remboursement
   * la réponse d'un changement de statut.
   */
  async run<T>(scope: string, key: string, operation: () => Promise<T>): Promise<T> {
    const replay = await this.db.idempotencyKey.findFirst({ where: { scope, key } })
    if (replay) return replay.response as T

    const result = await operation()

    try {
      await this.db.idempotencyKey.create({
        data: tenantScoped({ scope, key, response: result as Prisma.InputJsonValue }),
      })
    } catch (error) {
      // P2002 = violation d'unicité : deux requêtes portant la même clé sont
      // arrivées ensemble et ont toutes deux manqué la lecture initiale. La
      // course est perdue, mais l'opération a bien eu lieu — on renvoie la
      // réponse gagnante pour que les deux appelants voient le même résultat.
      //
      // Cela ne rend pas l'opération atomique : deux transitions ont pu
      // s'appliquer. C'est acceptable ici parce que `canTransition` rejette la
      // seconde (l'état a déjà changé), et parce que le remboursement vérifie
      // le cumul déjà remboursé sous contrainte SQL.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.db.idempotencyKey.findFirst({ where: { scope, key } })
        if (winner) return winner.response as T
      }
      throw error
    }

    return result
  }
}
