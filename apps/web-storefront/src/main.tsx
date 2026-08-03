import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from './app/providers'
import { HomePage } from './app/routes/home.route'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root introuvable')

// TODO(#8): routeur + rendu serveur. Le storefront est le seul écran indexable :
// il devra être rendu côté serveur pour le SEO (doc/01 §6).
createRoot(container).render(
  <StrictMode>
    <Providers>
      <HomePage />
    </Providers>
  </StrictMode>,
)
