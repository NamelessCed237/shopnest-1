import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MAX_CART_LINES, type Money } from '@shopnest/contracts'

/**
 * Le panier vit dans le NAVIGATEUR, pas sur le serveur.
 *
 * Un panier serveur imposerait soit un compte, soit une session anonyme —
 * donc une table, une expiration, un ménage périodique, et une requête
 * réseau à chaque « ajouter ». Pour un panier qui survit rarement plus
 * d'une visite, c'est beaucoup d'infrastructure pour peu de valeur.
 *
 * Contrepartie assumée : ce panier n'est PAS une source de vérité. Les prix
 * qu'il retient servent à l'affichage, et le serveur les relit tous au moment
 * de payer. Un panier trafiqué ne change donc que ce que l'acheteur voit avant
 * de payer — jamais ce qu'il paie.
 */

export interface CartLine {
  productId: string
  variantId?: string
  /** Recopiés pour afficher le panier sans recharger le catalogue. */
  name: string
  slug: string
  unitPrice: Money
  imageUrl?: string
  quantity: number
}

interface CartState {
  lines: CartLine[]
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
}

/** Une ligne est identifiée par le COUPLE produit + déclinaison. */
export const lineKey = (line: Pick<CartLine, 'productId' | 'variantId'>): string =>
  line.variantId ? `${line.productId}:${line.variantId}` : line.productId

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],

      add: (line, quantity = 1) =>
        set((state) => {
          const key = lineKey(line)
          const existing = state.lines.find((candidate) => lineKey(candidate) === key)

          // Ajouter deux fois le même article INCRÉMENTE, ne duplique pas :
          // deux lignes identiques dans un panier se lisent comme un bogue, et
          // obligent à les supprimer une par une.
          if (existing) {
            return {
              lines: state.lines.map((candidate) =>
                lineKey(candidate) === key
                  ? { ...candidate, quantity: candidate.quantity + quantity }
                  : candidate,
              ),
            }
          }

          // Le serveur refuse au-delà de cette borne ; l'atteindre ici évite
          // de laisser remplir un panier qui sera rejeté au paiement.
          if (state.lines.length >= MAX_CART_LINES) return state

          return { lines: [...state.lines, { ...line, quantity }] }
        }),

      setQuantity: (key, quantity) =>
        set((state) => ({
          // Passer à zéro RETIRE la ligne. Une ligne à zéro est un article
          // qu'on ne commande pas, et le serveur la refuserait de toute façon.
          lines:
            quantity <= 0
              ? state.lines.filter((line) => lineKey(line) !== key)
              : state.lines.map((line) => (lineKey(line) === key ? { ...line, quantity } : line)),
        })),

      remove: (key) =>
        set((state) => ({ lines: state.lines.filter((line) => lineKey(line) !== key) })),

      clear: () => set({ lines: [] }),
    }),
    {
      name: 'shopnest.cart',
      // `lines` seul : les actions sont recréées au chargement, et les
      // sérialiser figerait le code d'une version dans le stockage du visiteur.
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
)

/**
 * Sous-total AFFICHÉ.
 *
 * Le nom compte : ce n'est pas le montant facturé. Le serveur recalcule le sien
 * à partir du catalogue, et c'est celui-là qui est débité. Les deux coïncident
 * tant qu'aucun prix n'a changé depuis la mise au panier.
 */
export function cartSubtotal(lines: CartLine[]): Money | undefined {
  const first = lines[0]
  if (!first) return undefined
  return {
    amountCents: lines.reduce((sum, line) => sum + line.unitPrice.amountCents * line.quantity, 0),
    currency: first.unitPrice.currency,
  }
}

export const cartCount = (lines: CartLine[]): number =>
  lines.reduce((sum, line) => sum + line.quantity, 0)
