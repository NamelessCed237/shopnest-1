import type {
  AdminTenant,
  CursorPage,
  ListTenantsQuery,
  PlanCode,
  PlatformSummary,
  TenantTheme,
} from '@shopnest/contracts'
import type { ApiClient, RequestOptions } from '../client.js'

/**
 * Back-office plateforme.
 *
 * Toutes les routes vivent sous `/admin/` : c'est de ce préfixe que le backend
 * déduit l'audience `admin`, donc le secret JWT à utiliser (doc/03 §5). Le
 * chemin n'est pas décoratif, il fait partie du contrat de sécurité.
 */
export function adminEndpoints(client: ApiClient) {
  return {
    summary: (options?: RequestOptions) =>
      client.get<PlatformSummary>('/admin/summary', undefined, options),

    listTenants: (query: Partial<ListTenantsQuery>, options?: RequestOptions) =>
      client.get<CursorPage<AdminTenant>>('/admin/tenants', query, options),

    tenant: (id: string, options?: RequestOptions) =>
      client.get<AdminTenant>(`/admin/tenants/${id}`, undefined, options),

    /** Renvoie la boutique COMPLÈTE : le client remplace son cache, il ne fusionne pas. */
    updateTheme: (id: string, theme: TenantTheme, options?: RequestOptions) =>
      client.patch<AdminTenant>(`/admin/tenants/${id}/theme`, { theme }, options),

    updatePlan: (id: string, planCode: PlanCode, options?: RequestOptions) =>
      client.patch<AdminTenant>(`/admin/tenants/${id}/plan`, { planCode }, options),
  }
}
