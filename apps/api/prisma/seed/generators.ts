/**
 * Générateurs DÉTERMINISTES pour les données de démonstration.
 *
 * Aucun `Math.random()` : deux exécutions du seed doivent produire exactement
 * la même base. Sans cela, une capture d'écran, un test d'intégration ou une
 * comparaison avant/après ne valent plus rien — et diagnostiquer un écart
 * devient impossible, puisque les données ont changé sous les pieds.
 *
 * Les distributions reprennent celles des fixtures du dashboard : elles ont été
 * calibrées pour que chaque écran montre quelque chose de crédible, ce qu'une
 * répartition uniforme ne fait pas.
 */

/** Générateur congruentiel linéaire — reproductible, suffisant ici. */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 2 ** 32
  }
}

export function weightedPick<T>(weights: readonly (readonly [T, number])[], roll: number): T {
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0)
  let threshold = roll * total
  for (const [value, weight] of weights) {
    threshold -= weight
    if (threshold <= 0) return value
  }
  return weights[0]![0]
}

export function daysAgo(reference: Date, days: number, hourSeed: number): Date {
  const date = new Date(reference)
  date.setUTCDate(date.getUTCDate() - days)
  date.setUTCHours(8 + (hourSeed % 12), (hourSeed * 7) % 60, 0, 0)
  return date
}

export const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Identités des acheteurs. Prénoms et noms d'Afrique francophone et d'Europe :
 * le produit vise ces marchés, et une démonstration peuplée de « John Doe »
 * teste mal le rendu des accents, des noms composés et des indicatifs
 * téléphoniques.
 */
export const IDENTITIES = [
  ['Aïcha', 'Ndiaye', '+221771234501', 320],
  ['Jean-Baptiste', 'Kouadio', '+225070234502', 275],
  ['Fatou', 'Diallo', '+224620234503', 210],
  ['Marc', 'Tchoumi', '+237690234504', 188],
  ['Sarah', 'Mballa', '+237677234505', 154],
  ['Ousmane', 'Traoré', '+223760234506', 132],
  ['Léa', 'Fongang', '+237655234507', 97],
  ['Ibrahim', 'Sow', '+221781234508', 64],
  ['Nadia', 'Bekele', '+251911234509', 41],
  ['Paul', 'Essomba', '+237699234510', 12],
  ['Mariam', 'Coulibaly', '+226700234511', 305],
  ['Kwame', 'Mensah', '+233240234512', 268],
  ['Chantal', 'Ngo Bell', '+237694234513', 244],
  ['Sekou', 'Camara', '+224621234514', 199],
  ['Awa', 'Sylla', '+221776234515', 176],
  ['Thierry', 'Mabiala', '+242060234516', 149],
  ['Grace', 'Ilunga', '+243810234517', 121],
  ['Yann', 'Abega', '+237678234518', 108],
  ['Zeinab', 'Haidara', '+223770234519', 86],
  ['Serge', 'Nkoulou', '+237696234520', 72],
  ['Amina', 'Bello', '+234803234521', 58],
  ['Didier', 'Kabongo', '+243990234522', 35],
  ['Hawa', 'Konate', '+225050234523', 21],
  ['Emmanuel', 'Oyono', '+241060234524', 5],
] as const satisfies readonly (readonly [string, string, string, number])[]

/**
 * Répartition des statuts : majorité livrée, échecs rares mais présents.
 *
 * Une distribution uniforme donnerait cinq badges rouges sur six lignes — un
 * écran qu'on n'obtient jamais en production, et qui empêche de juger le
 * rendu réel.
 */
export const STATUS_WEIGHTS = [
  ['delivered', 42],
  ['shipped', 16],
  ['preparing', 12],
  ['paid', 10],
  ['awaiting_payment', 6],
  ['pending', 4],
  ['cancelled', 5],
  ['refunded', 3],
  ['payment_failed', 2],
] as const

/** Mobile Money domine sur les marchés visés : la démonstration doit le montrer. */
export const METHOD_WEIGHTS = [
  ['mtn_momo', 45],
  ['orange_money', 25],
  ['card', 28],
  ['bank_transfer', 2],
] as const

/**
 * Le statut du paiement DÉCOULE de celui de la commande.
 *
 * Une commande livrée dont le paiement serait « en échec » n'existe pas :
 * une donnée de démonstration incohérente produit des écrans impossibles à
 * obtenir en production, et fait chercher des bugs qui n'existent pas.
 */
export function paymentStatusFor(status: string): string {
  switch (status) {
    case 'payment_failed':
      return 'failed'
    case 'awaiting_payment':
      return 'awaiting_confirmation'
    case 'refunded':
      return 'refunded'
    case 'pending':
      return 'pending'
    default:
      return 'settled'
  }
}
