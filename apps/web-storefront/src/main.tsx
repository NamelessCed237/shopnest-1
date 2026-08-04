import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from './app/providers'
import { HomePage } from './app/routes/home.route'
import { ShopPage } from './app/routes/shop.route'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root introuvable')

/**
 * Aiguillage MINIMAL sur le chemin, en attendant le vrai routeur.
 *
 * TODO(#8) : routeur + rendu serveur. Le storefront est le seul écran
 * indexable du produit ; il devra être rendu côté serveur pour le
 * référencement (doc/01 §6), et c'est ce choix-là qui déterminera la forme du
 * routage. Poser un routeur client maintenant reviendrait à la choisir à
 * l'aveugle, puis à la défaire.
 *
 * Deux pages, donc deux cas : la vitrine de démonstration, qui tourne encore
 * sur des fixtures, et la boutique réelle, branchée sur l'API.
 */
const Page = window.location.pathname.startsWith('/boutique') ? ShopPage : HomePage

createRoot(container).render(
  <StrictMode>
    <Providers>
      <Page />
    </Providers>
  </StrictMode>,
)
