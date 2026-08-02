import { useMutation } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import type { AppError, LoginInput, LoginResponse } from '@shopnest/contracts'
import { api } from '@/lib/api'
import { useSessionStore } from '../model/session.store'

/**
 * doc/04 §4 — toute écriture passe par un hook de la feature, jamais par un
 * `fetch` dans un composant.
 */
export function useLogin() {
  const signIn = useSessionStore((s) => s.signIn)
  const queryClient = useQueryClient()

  return useMutation<LoginResponse, AppError, LoginInput>({
    mutationFn: (input) => api.auth.loginTenantUser(input),
    onSuccess: (response) => {
      signIn(response.user, {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      })
      // Le cache appartenait à la session précédente : on repart de zéro plutôt
      // que de risquer d'afficher les données d'un autre compte.
      void queryClient.clear()
    },
    // Pas de retry : réessayer un mot de passe refusé consomme le quota de
    // 5 tentatives / 15 min du serveur pour rien (doc/03 §5).
    retry: false,
  })
}

export function useLogout() {
  const signOut = useSessionStore((s) => s.signOut)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const refreshToken = localStorage.getItem('shopnest.refresh')
      // On révoque côté serveur si possible, mais l'échec ne doit jamais
      // empêcher la déconnexion locale.
      if (refreshToken) await api.auth.logout({ refreshToken }).catch(() => undefined)
    },
    onSettled: () => {
      signOut()
      queryClient.clear()
    },
  })
}
