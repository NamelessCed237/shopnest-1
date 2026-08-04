import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from '@shopnest/api-client'
import type {
  AppError,
  TeamMember,
  TenantSettings,
  UpdateTenantSettingsInput,
} from '@shopnest/contracts'
import { api } from '@/lib/api'

export function useTenantSettings() {
  return useQuery<TenantSettings, AppError>({
    queryKey: settingsKeys.profile(),
    queryFn: () => api.settings.profile(),
    staleTime: 5 * 60_000,
  })
}

export function useTeam() {
  return useQuery<TeamMember[], AppError>({
    queryKey: settingsKeys.team(),
    queryFn: () => api.settings.team(),
    staleTime: 5 * 60_000,
  })
}

export function useUpdateTenantSettings() {
  const queryClient = useQueryClient()

  return useMutation<TenantSettings, AppError, UpdateTenantSettingsInput>({
    mutationFn: (input) => api.settings.update(input),
    // On écrit la réponse dans le cache plutôt que d'invalider : le serveur
    // renvoie le profil complet, refaire un GET derrière serait un aller-retour
    // pour des données qu'on tient déjà.
    onSuccess: (updated) => queryClient.setQueryData(settingsKeys.profile(), updated),
  })
}
