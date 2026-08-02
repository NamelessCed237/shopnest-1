import { AsyncLocalStorage } from 'node:async_hooks'
import type { PlanCode } from '@shopnest/contracts'
import { AppException } from '../common/errors/app.exception'

/**
 * doc/03 §3.2 — le contexte tenant est AMBIANT.
 *
 * Aucun service ne reçoit `tenantId` en paramètre : c'est précisément ce qui rend
 * l'oubli impossible. Un développeur ne peut pas « oublier de filtrer » puisqu'il
 * n'a jamais la main sur le filtre.
 */

export interface TenantStore {
  tenantId: string
  plan: PlanCode
  /** Vrai uniquement pour un super admin ayant explicitement demandé un accès inter-tenant. */
  crossTenant?: boolean
  /** Renseigné lors d'une impersonation — journalisé systématiquement. */
  impersonatedBy?: string
}

const als = new AsyncLocalStorage<TenantStore>()

export const TenantContext = {
  run<T>(store: TenantStore, fn: () => T): T {
    return als.run(store, fn)
  },

  get(): TenantStore | undefined {
    return als.getStore()
  },

  /**
   * DÉFAUT SÉCURISÉ (doc/02 §1.6) : en l'absence de contexte, on refuse la requête.
   * On ne renvoie JAMAIS de données non filtrées — une liste complète vaut mieux
   * qu'une exception seulement du point de vue de celui qui n'a pas payé la fuite.
   */
  getTenantIdOrThrow(): string {
    const store = als.getStore()
    if (!store?.tenantId) {
      throw new AppException('FORBIDDEN', 'tenant context missing', {
        userMessageKey: 'errors.forbidden',
      })
    }
    return store.tenantId
  },

  isCrossTenant(): boolean {
    return als.getStore()?.crossTenant === true
  },
}
