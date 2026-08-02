import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from './app/providers'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root introuvable')

createRoot(container).render(
  <StrictMode>
    <Providers>
      {/* TODO(#4): brancher le routeur TanStack Router (doc/04 §6) */}
      <main className="p-lg">
        <h1 className="text-xl text-text-primary">ShopNest — Boutique</h1>
      </main>
    </Providers>
  </StrictMode>,
)
