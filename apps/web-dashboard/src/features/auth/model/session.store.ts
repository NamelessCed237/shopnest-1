import { create } from 'zustand'
import type { SessionUser } from '@shopnest/contracts'
import { api, tokenStorage } from '@/lib/api'

/**
 * doc/04 §3 — état client global : la session, pas les données serveur.
 *
 * `user` n'est jamais décodé du JWT côté client : il vient de la réponse du
 * serveur. Si le rôle a été rétrogradé depuis l'émission du token, c'est le
 * serveur qui fait foi — un rôle lu dans un token périmé ouvrirait des écrans
 * que l'API refusera de servir.
 */
interface SessionState {
  user: SessionUser | undefined
  status: 'unknown' | 'authenticated' | 'anonymous'
  signIn: (user: SessionUser, tokens: { accessToken: string; refreshToken: string }) => void
  signOut: () => void
  restore: () => Promise<void>
}

export const useSessionStore = create<SessionState>((set) => ({
  user: undefined,
  status: 'unknown',

  signIn: (user, tokens) => {
    tokenStorage.setTokens(tokens)
    set({ user, status: 'authenticated' })
  },

  signOut: () => {
    tokenStorage.clear()
    set({ user: undefined, status: 'anonymous' })
  },

  /**
   * Au démarrage. Un refresh token présent ne prouve pas qu'il est encore valide,
   * et il ne dit pas QUI est connecté : on effectue donc un vrai rafraîchissement.
   * Il rend le profil à jour et vérifie la session en un seul aller-retour.
   */
  restore: async () => {
    const refreshToken = tokenStorage.getRefreshToken()
    if (!refreshToken) {
      set({ status: 'anonymous' })
      return
    }

    try {
      const response = await api.auth.refresh({ refreshToken })
      tokenStorage.setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      })
      set({ user: response.user, status: 'authenticated' })
    } catch {
      // Token révoqué, expiré, ou serveur redémarré : on repart proprement
      // sur un état anonyme plutôt que de laisser une session fantôme.
      tokenStorage.clear()
      set({ user: undefined, status: 'anonymous' })
    }
  },
}))
