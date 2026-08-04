import type {
  TeamMember,
  TenantSettings,
  UpdateTenantSettingsInput,
} from '@shopnest/contracts'
import type { ApiClient, RequestOptions } from '../client.js'

export function settingsEndpoints(client: ApiClient) {
  return {
    profile: (options?: RequestOptions) =>
      client.get<TenantSettings>('/settings', undefined, options),

    /** Renvoie le profil COMPLET : le client remplace son cache, il ne le fusionne pas. */
    update: (input: UpdateTenantSettingsInput, options?: RequestOptions) =>
      client.patch<TenantSettings>('/settings', input, options),

    team: (options?: RequestOptions) =>
      client.get<TeamMember[]>('/settings/team', undefined, options),
  }
}
