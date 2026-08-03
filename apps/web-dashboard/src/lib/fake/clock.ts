/**
 * Date de référence des fixtures — SOURCE UNIQUE.
 *
 * Toutes les données de démonstration (commandes, ancienneté des comptes,
 * séries du tableau de bord) sont calculées à partir d'ici. Utiliser la date
 * réelle rendrait les captures et les tests instables ; la dupliquer par fichier
 * ferait dériver les écrans les uns par rapport aux autres.
 */
export const FAKE_TODAY = new Date('2026-08-02T12:00:00.000Z')

/** Date ISO d'il y a `days` jours, minuit UTC. */
export function daysAgoIso(days: number): string {
  const date = new Date(FAKE_TODAY)
  date.setUTCDate(date.getUTCDate() - days)
  date.setUTCHours(0, 0, 0, 0)
  return date.toISOString()
}
