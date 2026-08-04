import { create } from 'zustand'
import type { SessionUser } from '@shopnest/contracts'
import { api, tokenStorage } from '@/lib/api'

/**
 * doc/04 §3 — état client global : la session, pas les données serveur.
 *
 * `user` n'est jamais décodé du JWT côté client : il vient de la réponse du
 * serveur. Un rôle lu dans un jeton périmé ouvrirait des écrans que l'API
 * refusera ensuite de servir.
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

  restore: async () => {
    const refreshToken = tokenStorage.getRefreshToken()
    if (!refreshToken) {
      set({ status: 'anonymous' })
      return
    }

    try {
      const response = await api.auth.refresh({ refreshToken })

      /*
       * Contrôle SUPPLÉMENTAIRE par rapport au dashboard vendeur.
       *
       * Le rafraîchissement rend un jeton correspondant au compte du porteur,
       * quel qu'il soit. Sur cet hôte, un jeton de vendeur resté en mémoire
       * ouvrirait donc une session « connectée » dans le back-office —
       * inutilisable puisque l'API refuserait chaque appel, mais affichant une
       * interface d'administration à quelqu'un qui n'y a pas droit.
       */
      if (response.user.role !== 'super_admin') {
        tokenStorage.clear()
        set({ user: undefined, status: 'anonymous' })
        return
      }

      tokenStorage.setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      })
      set({ user: response.user, status: 'authenticated' })
    } catch {
      // Jeton révoqué, expiré, ou serveur redémarré : on repart proprement sur
      // un état anonyme plutôt que de laisser une session fantôme.
      tokenStorage.clear()
      set({ user: undefined, status: 'anonymous' })
    }
  },
}))
