/**
 * Libellé « X sur Y » d'un pied de tableau, quand Y n'est pas toujours connu.
 *
 * La pagination par curseur ne renvoie `total` que lorsque le COUNT est
 * abordable (doc/02 §2.3) : l'API réelle l'omet là où les fixtures le
 * fournissaient. Le `?? 0` qu'on écrit spontanément affiche alors « 5 produits
 * affichés sur 0 » — visiblement faux, et le genre de détail qui fait douter
 * l'utilisateur du reste des chiffres.
 *
 * Centralisé ici parce que les quatre tableaux du dashboard ont exactement le
 * même besoin, et qu'un cinquième referait la même erreur.
 */
export function countLabelKey(
  domainKey: string,
  shown: number,
  total: number | undefined,
): { key: string; count: number; params: Record<string, number> } {
  return total === undefined
    ? { key: 'common.countLoaded', count: shown, params: { shown } }
    : { key: domainKey, count: shown, params: { shown, total } }
}
