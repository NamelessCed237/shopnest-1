/**
 * doc/02 §2.3 — un `find` dans une boucle est un bug de performance : O(n × m).
 * Ces helpers rendent l'indexation en O(1) plus courte à écrire que la faute.
 */

/** Indexe une liste par clé. O(n) une fois, puis O(1) par accès. */
export function indexBy<T, K extends string | number>(items: readonly T[], key: (item: T) => K) {
  const map = new Map<K, T>()
  for (const item of items) map.set(key(item), item)
  return map
}

/** Regroupe une liste par clé. O(n). */
export function groupBy<T, K extends string | number>(items: readonly T[], key: (item: T) => K) {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const bucket = map.get(k)
    if (bucket) bucket.push(item)
    else map.set(k, [item])
  }
  return map
}

/** Découpe en lots — utilisé pour les insertions en masse (import CSV). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be >= 1')
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Déduplique en O(n) via un Set — jamais avec un `filter(indexOf)` en O(n²). */
export function uniqueBy<T, K>(items: readonly T[], key: (item: T) => K): T[] {
  const seen = new Set<K>()
  const out: T[] = []
  for (const item of items) {
    const k = key(item)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

/** Tri non mutant — `Array.prototype.sort` mute le tableau source. */
export function sortBy<T>(items: readonly T[], compare: (a: T, b: T) => number): T[] {
  return [...items].sort(compare)
}
