import { slugify } from './generators'

/**
 * Catalogues de démonstration, un par boutique.
 *
 * Deux univers différents (électronique / mode) et non deux fois le même :
 * c'est ce qui rend visible, à l'écran, qu'une fuite d'isolation s'est produite.
 * Avec deux catalogues identiques, un produit affiché chez le mauvais vendeur
 * passerait inaperçu.
 */

export interface SeedCategory {
  name: string
  description: string
  children: string[]
}

export interface SeedProduct {
  name: string
  /** Prix en unités MINEURES de la devise du tenant. */
  price: number
  stock: number
  lowStockThreshold: number
  category: string
  status: 'active' | 'draft' | 'archived'
  /** Déclinaisons. Le stock et le prix du produit en sont alors dérivés. */
  variants?: { name: string; price: number; stock: number; attributes: Record<string, string> }[]
}

export interface SeedCatalog {
  categories: SeedCategory[]
  products: SeedProduct[]
}

/**
 * XAF n'a PAS de sous-unité : 185000 se lit « 185 000 FCFA », pas « 1 850,00 ».
 * Les montants sont donc des unités entières ici, et des centimes pour l'euro —
 * c'est exactement la distinction que `formatMoney` applique à l'affichage.
 */
export const ALPHA_CATALOG: SeedCatalog = {
  categories: [
    {
      name: 'Téléphonie',
      description: 'Smartphones, accessoires et forfaits.',
      children: ['Smartphones', 'Accessoires téléphone'],
    },
    {
      name: 'Informatique',
      description: 'Ordinateurs portables, écrans et périphériques.',
      children: ['Ordinateurs portables', 'Écrans'],
    },
    { name: 'Audio', description: 'Casques, enceintes et écouteurs.', children: ['Casques'] },
    { name: 'Énergie', description: 'Batteries externes et solaire.', children: [] },
  ],
  products: [
    {
      name: 'Smartphone Tecno Camon 30',
      price: 185_000,
      stock: 0,
      lowStockThreshold: 5,
      category: 'Smartphones',
      status: 'active',
      // Produit à variantes : son stock et son prix sont DÉRIVÉS (deriveStock /
      // derivePrice). Le stock propre à 0 est volontaire — il ne doit jamais
      // s'afficher, et s'il apparaît c'est que la dérivation est cassée.
      variants: [
        {
          name: '128 Go — Noir',
          price: 185_000,
          stock: 14,
          attributes: { Stockage: '128 Go', Couleur: 'Noir' },
        },
        {
          name: '256 Go — Noir',
          price: 215_000,
          stock: 6,
          attributes: { Stockage: '256 Go', Couleur: 'Noir' },
        },
        {
          name: '256 Go — Bleu',
          price: 215_000,
          stock: 3,
          attributes: { Stockage: '256 Go', Couleur: 'Bleu' },
        },
      ],
    },
    {
      name: 'Smartphone Samsung Galaxy A25',
      price: 210_000,
      stock: 22,
      lowStockThreshold: 6,
      category: 'Smartphones',
      status: 'active',
    },
    {
      name: 'Smartphone Itel A70',
      price: 62_000,
      stock: 4,
      lowStockThreshold: 8,
      category: 'Smartphones',
      status: 'active',
    },
    {
      name: 'Coque silicone renforcée',
      price: 4_500,
      stock: 120,
      lowStockThreshold: 20,
      category: 'Accessoires téléphone',
      status: 'active',
    },
    {
      name: 'Chargeur rapide 33 W',
      price: 12_000,
      stock: 0,
      lowStockThreshold: 10,
      category: 'Accessoires téléphone',
      status: 'active',
    },
    {
      name: 'Verre trempé anti-rayures',
      price: 3_000,
      stock: 200,
      lowStockThreshold: 30,
      category: 'Accessoires téléphone',
      status: 'active',
    },
    {
      name: 'Ordinateur portable HP 250 G9',
      price: 480_000,
      stock: 7,
      lowStockThreshold: 3,
      category: 'Ordinateurs portables',
      status: 'active',
    },
    {
      name: 'Ordinateur portable Lenovo IdeaPad 3',
      price: 395_000,
      stock: 2,
      lowStockThreshold: 3,
      category: 'Ordinateurs portables',
      status: 'active',
    },
    {
      name: 'MacBook Air M2',
      price: 1_150_000,
      stock: 3,
      lowStockThreshold: 2,
      category: 'Ordinateurs portables',
      status: 'active',
    },
    {
      name: 'Écran incurvé 27 pouces',
      price: 195_000,
      stock: 11,
      lowStockThreshold: 4,
      category: 'Écrans',
      status: 'active',
    },
    {
      name: 'Écran bureautique 24 pouces',
      price: 98_000,
      stock: 18,
      lowStockThreshold: 5,
      category: 'Écrans',
      status: 'active',
    },
    {
      name: 'Casque Bluetooth JBL Tune 520',
      price: 38_000,
      stock: 26,
      lowStockThreshold: 8,
      category: 'Casques',
      status: 'active',
    },
    {
      name: 'Écouteurs sans fil Oraimo FreePods',
      price: 18_500,
      stock: 5,
      lowStockThreshold: 12,
      category: 'Casques',
      status: 'active',
    },
    {
      name: 'Enceinte portable étanche',
      price: 45_000,
      stock: 9,
      lowStockThreshold: 4,
      category: 'Audio',
      status: 'active',
    },
    {
      name: 'Batterie externe 20 000 mAh',
      price: 22_000,
      stock: 33,
      lowStockThreshold: 10,
      category: 'Énergie',
      status: 'active',
    },
    {
      name: 'Panneau solaire portable 60 W',
      price: 87_000,
      stock: 6,
      lowStockThreshold: 3,
      category: 'Énergie',
      status: 'active',
    },
    {
      name: 'Onduleur 650 VA',
      price: 55_000,
      stock: 14,
      lowStockThreshold: 5,
      category: 'Énergie',
      status: 'draft',
    },
    {
      name: 'Clavier mécanique rétroéclairé',
      price: 32_000,
      stock: 0,
      lowStockThreshold: 6,
      category: 'Informatique',
      status: 'archived',
    },
  ],
}

export const BETA_CATALOG: SeedCatalog = {
  categories: [
    {
      name: 'Femme',
      description: 'Prêt-à-porter féminin.',
      children: ['Robes', 'Hauts femme'],
    },
    { name: 'Homme', description: 'Prêt-à-porter masculin.', children: ['Chemises'] },
    { name: 'Accessoires', description: 'Sacs, ceintures et bijoux.', children: ['Sacs'] },
    { name: 'Chaussures', description: 'Toutes catégories.', children: [] },
  ],
  products: [
    {
      name: 'Robe portefeuille en lin',
      price: 8_900,
      stock: 0,
      lowStockThreshold: 5,
      category: 'Robes',
      status: 'active',
      variants: [
        { name: 'Taille S — Écru', price: 8_900, stock: 4, attributes: { Taille: 'S', Couleur: 'Écru' } },
        { name: 'Taille M — Écru', price: 8_900, stock: 7, attributes: { Taille: 'M', Couleur: 'Écru' } },
        { name: 'Taille L — Noir', price: 9_400, stock: 2, attributes: { Taille: 'L', Couleur: 'Noir' } },
      ],
    },
    {
      name: 'Robe longue imprimée',
      price: 11_500,
      stock: 12,
      lowStockThreshold: 4,
      category: 'Robes',
      status: 'active',
    },
    {
      name: 'Blouse en coton bio',
      price: 5_900,
      stock: 3,
      lowStockThreshold: 6,
      category: 'Hauts femme',
      status: 'active',
    },
    {
      name: 'Débardeur côtelé',
      price: 2_900,
      stock: 48,
      lowStockThreshold: 10,
      category: 'Hauts femme',
      status: 'active',
    },
    {
      name: 'Chemise oxford',
      price: 6_500,
      stock: 21,
      lowStockThreshold: 6,
      category: 'Chemises',
      status: 'active',
    },
    {
      name: 'Chemise en lin manches courtes',
      price: 5_500,
      stock: 0,
      lowStockThreshold: 5,
      category: 'Chemises',
      status: 'active',
    },
    {
      name: 'Sac cabas en toile',
      price: 4_200,
      stock: 30,
      lowStockThreshold: 8,
      category: 'Sacs',
      status: 'active',
    },
    {
      name: 'Sac à main cuir grainé',
      price: 14_900,
      stock: 2,
      lowStockThreshold: 3,
      category: 'Sacs',
      status: 'active',
    },
    {
      name: 'Ceinture cuir tressé',
      price: 3_500,
      stock: 17,
      lowStockThreshold: 5,
      category: 'Accessoires',
      status: 'active',
    },
    {
      name: 'Baskets en toile recyclée',
      price: 7_900,
      stock: 9,
      lowStockThreshold: 4,
      category: 'Chaussures',
      status: 'active',
    },
    {
      name: 'Mocassins cuir',
      price: 12_900,
      stock: 4,
      lowStockThreshold: 4,
      category: 'Chaussures',
      status: 'active',
    },
    {
      name: 'Écharpe laine mérinos',
      price: 4_900,
      stock: 25,
      lowStockThreshold: 8,
      category: 'Accessoires',
      status: 'draft',
    },
  ],
}

/** Le slug est dérivé du nom : une source unique, comme dans l'application. */
export const slugFor = (name: string): string => slugify(name)
