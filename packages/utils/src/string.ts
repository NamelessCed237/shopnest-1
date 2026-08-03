export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

/**
 * Normalisation pour la recherche : sans accents, sans casse.
 *
 * Les utilisateurs tapent « ecran », pas « écran » — a fortiori sur un clavier
 * mobile. Une recherche sensible aux accents renvoie zéro résultat sur un
 * catalogue français et donne l'impression que le produit n'existe pas.
 *
 * Le pendant côté base est l'extension PostgreSQL `unaccent` (doc/03 §4) :
 * les deux doivent rester alignés, sinon le mode démonstration et la production
 * ne filtrent pas de la même façon.
 */
export function normalizeForSearch(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : `${input.slice(0, max - 1)}…`
}

/**
 * doc/02 §11 — aucune donnée personnelle en clair dans les logs.
 * Masque un numéro Mobile Money / téléphone : +237690123456 → +237•••••3456
 */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return '••••'
  return `${phone.slice(0, 4)}${'•'.repeat(Math.max(0, phone.length - 8))}${phone.slice(-4)}`
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  if (!domain) return '•••'
  return `${local.slice(0, 2)}•••@${domain}`
}
