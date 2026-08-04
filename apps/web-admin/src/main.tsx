import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { Providers } from './app/providers'
import { router } from './app/router'
import { useSessionStore } from './features/auth'
import './styles/index.css'

/**
 * On restaure la session AVANT le premier rendu.
 *
 * Sans cette attente, la garde de route s'exécuterait sur un statut `unknown`
 * et renverrait un administrateur déjà connecté vers /login — un aller-retour
 * visible à chaque rechargement.
 *
 * Fonction plutôt qu'un `await` de haut niveau : celui-ci exigerait de relever
 * la cible de build, donc de réduire le support navigateur pour un détail
 * d'amorçage.
 */
async function bootstrap(): Promise<void> {
  const container = document.getElementById('root')
  if (!container) throw new Error('#root introuvable')

  await useSessionStore.getState().restore()

  createRoot(container).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  )
}

void bootstrap()
