import { Injectable, type OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { TenantContext } from '../tenancy/tenant-context'

/**
 * doc/03 §3.3 — ISOLATION AUTOMATIQUE. Le fichier le plus critique du backend.
 *
 * Aucun repository n'écrit `tenantId` à la main : l'extension l'injecte sur toutes
 * les opérations des modèles scopés. Une erreur ici = fuite de données entre vendeurs.
 */

/**
 * Modèles portant une colonne tenant_id.
 * ⚠️ Tout nouveau modèle scopé DOIT être ajouté ici. Un test générique parcourt le
 * schéma Prisma et échoue si un modèle a `tenantId` sans figurer dans ce Set (doc/08 §3).
 */
export const TENANT_SCOPED_MODELS = new Set([
  'TenantUser',
  'IdempotencyKey',
  'Product',
  'ProductVariant',
  'Category',
  'Order',
  'OrderItem',
  'Customer',
  'Cart',
  'CartItem',
  'Inventory',
  'Discount',
  'Review',
  'Address',
  'Invoice',
  'Payment',
])

// Modèles GLOBAUX, volontairement exclus : Tenant, Plan, SuperAdmin, AuditLog, WebhookEvent.

const READ_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
])
const UPDATE_OPS = new Set(['update', 'updateMany', 'upsert'])
const DELETE_OPS = new Set(['delete', 'deleteMany'])

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  /**
   * Client isolé — c'est CELUI-CI qui est injecté dans les repositories.
   * Le client brut n'est utilisé que par les migrations et les modèles globaux.
   */
  withTenantIsolation() {
    return this.$extends({
      query: {
        $allModels: {
          $allOperations: ({ model, operation, args, query }) => {
            if (!model || !TENANT_SCOPED_MODELS.has(model)) {
              return query(args)
            }

            // Super admin explicitement en mode inter-tenant (@CrossTenant + audit).
            if (TenantContext.isCrossTenant()) {
              return query(args)
            }

            const tenantId = TenantContext.getTenantIdOrThrow()
            const typed = args as Record<string, unknown>

            if (READ_OPS.has(operation) || DELETE_OPS.has(operation) || UPDATE_OPS.has(operation)) {
              typed.where = { ...(typed.where as object), tenantId }
            }

            // Écriture : on FORCE la valeur. On n'accepte jamais le tenantId du client.
            if (operation === 'create') {
              typed.data = { ...(typed.data as object), tenantId }
            }
            if (operation === 'createMany') {
              const data = typed.data
              typed.data = Array.isArray(data)
                ? data.map((row: object) => ({ ...row, tenantId }))
                : { ...(data as object), tenantId }
            }
            if (operation === 'upsert') {
              typed.create = { ...(typed.create as object), tenantId }
            }

            return this.withRlsContext(tenantId, query(typed))
          },
        },
      },
    })
  }

  /**
   * Client positionnant le contexte RLS pour un tenant DONNÉ, sans passer par
   * `TenantContext`.
   *
   * Réservé aux rares chemins qui s'exécutent hors du contexte de requête : le
   * rafraîchissement de session lit `tenant_users` avant même de savoir quelle
   * boutique est visée — l'information vient du refresh token lui-même.
   *
   * Contrairement à `withTenantIsolation()`, ce client N'INJECTE PAS de filtre
   * `tenantId` : seule la RLS scope la requête. À n'utiliser que sur des accès
   * par identifiant unique.
   */
  forTenant(tenantId: string) {
    return this.$extends({
      query: {
        $allModels: {
          $allOperations: ({ model, args, query }) =>
            model && TENANT_SCOPED_MODELS.has(model)
              ? this.withRlsContext(tenantId, query(args))
              : query(args),
        },
      },
    })
  }

  /**
   * doc/03 §3.4 — DEUXIÈME BARRIÈRE : Row Level Security PostgreSQL.
   *
   * Le middleware applicatif peut être contourné par une requête SQL brute ; la
   * RLS non. Il faut que les DEUX tombent pour qu'une fuite se produise.
   *
   * Trois contraintes dictent cette forme, qui surprend à la lecture :
   *
   *   1. La politique lit `current_setting('app.tenant_id')`. Ce réglage vit
   *      dans une SESSION — or le pooler Supabase en mode transaction recycle
   *      les connexions entre deux requêtes. Un réglage persistant serait donc
   *      hérité par la requête suivante, d'un AUTRE tenant : exactement la
   *      fuite que la RLS doit empêcher. D'où `set_config(..., true)`, dont la
   *      portée est la transaction.
   *   2. Il faut donc que le réglage et la requête partagent une transaction.
   *   3. `query()` produit une PrismaPromise déjà liée à ce client ; on ne peut
   *      pas la rejouer sur un client de transaction interactive. La forme
   *      « tableau » de `$transaction` accepte en revanche des PrismaPromise
   *      existantes et les exécute dans une même transaction — c'est le motif
   *      documenté par Prisma pour la RLS.
   */
  private async withRlsContext<T>(tenantId: string, pending: Promise<T>): Promise<T> {
    const [, result] = await this.$transaction([
      this.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${assertUuid(tenantId)}', true)`),
      // `query()` est typée `Promise` mais renvoie bien une PrismaPromise à
      // l'exécution : c'est ce que la forme tableau de `$transaction` attend.
      pending as unknown as ReturnType<PrismaClient['$executeRawUnsafe']>,
    ])
    return result as T
  }
}

/**
 * L'UNIQUE cast toléré de la couche données (doc/02 §4).
 *
 * `tenantId` est injecté à l'exécution par l'extension d'isolation, mais le typage
 * Prisma généré l'exige à la compilation. Plutôt que de le répéter dans chaque
 * repository — ce qui rouvrirait la porte à un tenantId venu du client — on le
 * déclare ici, une fois, à l'endroit qui porte déjà la responsabilité de l'isolation.
 */
export function tenantScoped<T extends object>(data: T): T & { tenantId: string } {
  return data as T & { tenantId: string }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Le tenantId est interpolé dans du SQL : on refuse tout ce qui n'est pas un UUID. */
function assertUuid(value: string): string {
  if (!UUID_RE.test(value)) throw new Error('invalid tenant id')
  return value
}
