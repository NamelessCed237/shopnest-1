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

            return query(typed)
          },
        },
      },
    })
  }

  /**
   * doc/03 §3.4 — DEUXIÈME BARRIÈRE : Row Level Security PostgreSQL.
   * Le middleware applicatif peut être contourné par une requête SQL brute ;
   * la RLS non. Il faut que les deux tombent pour qu'une fuite se produise.
   */
  async runWithRls<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${assertUuid(tenantId)}'`)
      return fn()
    })
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
