# 02 — Conventions et bonnes pratiques

## 1. Principes de développement {#principes}

Ces principes gouvernent tout le reste du document. Quand deux conventions se contredisent,
c'est le principe le plus haut dans cette liste qui tranche.

### 1.1 KISS — *Keep It Simple, Stupid*

**La solution la plus simple qui résout le problème réel est la bonne solution.**

La complexité est le coût principal d'un projet sur la durée : elle se paie à chaque lecture,
chaque correction, chaque arrivée d'un nouveau développeur. Un code « malin » est un code que
personne n'osera modifier dans six mois.

```ts
// ❌ Malin, illisible, impossible à déboguer
const total = items.reduce((a, i) => a + (i.p * i.q) * (1 - (d?.[i.c] ?? 0)), 0)

// ✅ Explicite. Plus long à écrire, infiniment moins cher à maintenir.
function computeCartTotal(items: CartItem[], discountsByCategory: Map<string, number>): Money {
  let totalCents = 0
  for (const item of items) {
    const lineCents = item.unitPriceCents * item.quantity
    const discountRate = discountsByCategory.get(item.categoryId) ?? 0
    totalCents += Math.round(lineCents * (1 - discountRate))
  }
  return { amountCents: totalCents, currency: 'EUR' }
}
```

Signaux d'alerte concrets : plus de 3 niveaux d'imbrication, un ternaire imbriqué, une
fonction qui ne tient pas sur un écran, un nom de variable d'une lettre en dehors d'un index
de boucle, une abstraction dont on ne sait pas expliquer l'utilité en une phrase.

### 1.2 DRY — *Don't Repeat Yourself*

**Toute connaissance métier n'a qu'une seule représentation faisant autorité.**

Attention au contresens le plus répandu : DRY ne concerne pas les lignes de code identiques,
mais la **connaissance** dupliquée. Deux fragments qui se ressemblent aujourd'hui par
coïncidence ne doivent pas être fusionnés — ils évolueront différemment, et l'abstraction
prématurée coûtera plus cher que la duplication.

```ts
// ❌ La règle « le plan Basic est limité à 100 produits » existe à 3 endroits.
//    Le jour où elle change, on en oublie un.
if (products.length >= 100) …            // dans le service
{ maxProducts: 100 }                     // dans le seed
<Text>Jusqu'à 100 produits</Text>        // dans la page tarifs

// ✅ Une seule source de vérité, importée partout
// packages/contracts/src/entities/plan.contract.ts
export const PLAN_LIMITS = {
  basic:      { maxProducts: 100,      transactionFeeRate: 0.025 },
  pro:        { maxProducts: 5_000,    transactionFeeRate: 0.015 },
  enterprise: { maxProducts: Infinity, transactionFeeRate: null },
} as const
```

Dans ShopNest, les points DRY structurants sont déjà en place — les respecter suffit :

| Connaissance | Source unique |
|---|---|
| Forme des données d'API | `@shopnest/contracts` |
| Règles de validation | Le schéma Zod, partagé serveur ↔ client |
| Limites et tarifs des plans | `PLAN_LIMITS` dans `contracts` |
| Valeurs de design | `@shopnest/tokens` |
| Textes visibles | `@shopnest/i18n` |
| Comportement d'un composant | Le hook headless de `@shopnest/core` |

**Règle des trois occurrences :** on duplique sans culpabilité à la 2ᵉ occurrence, on
factorise à la 3ᵉ. À la 3ᵉ, on connaît enfin les axes de variation réels.

### 1.3 YAGNI — *You Aren't Gonna Need It*

**On ne construit pas pour un besoin hypothétique.**

```ts
// ❌ « On aura peut-être d'autres devises et d'autres stratégies d'arrondi un jour »
interface PriceStrategy { compute(ctx: PricingContext): Money }
class PriceStrategyFactory { register(k: string, s: PriceStrategy) {} }
// 200 lignes, un seul implémenteur, personne n'ose y toucher

// ✅ Ce dont on a besoin aujourd'hui, refactorable demain
function computePrice(product: Product, quantity: number): Money
```

Nuance importante : YAGNI porte sur les **abstractions spéculatives**, pas sur les fondations
dont l'absence coûte une réécriture. L'isolation multi-tenant, l'idempotence des paiements et
les frontières de packages ne sont pas du YAGNI — ce sont des invariants qu'on ne peut pas
rétro-adapter à moindre coût. Le critère : *« si je l'ajoute plus tard, est-ce que je réécris
tout ? »* Si oui, c'est une fondation. Si non, c'est du YAGNI.

### 1.4 SOLID — la lecture utile pour ce projet

Sans dogmatisme. Trois lettres sur cinq comptent vraiment ici :

- **S — Responsabilité unique.** Un module a une seule raison de changer. C'est exactement le
  découpage controller / service / repository de [03](./03-backend.md#2-anatomie-dun-module) :
  le controller change quand l'API change, le service quand la règle métier change, le
  repository quand le stockage change. Corollaire pratique : un fichier qui change pour trois
  raisons différentes doit être découpé.

- **O — Ouvert/fermé.** On étend sans modifier. Ajouter Wave ou M-Pesa comme prestataire de
  paiement = créer une classe implémentant `PaymentProvider`, sans toucher à `OrdersService`.
  De même, un nouveau cas d'usage du `Dropdown` = une nouvelle `source`, pas une modification
  du composant.

- **D — Inversion des dépendances.** On dépend d'interfaces, pas d'implémentations.
  `OrdersService` dépend de `PaymentProvider`, jamais de `StripeService`. C'est ce qui rend
  les tests possibles sans réseau et la substitution de prestataire réaliste.

*L (Liskov)* et *I (ségrégation des interfaces)* s'appliquent naturellement en TypeScript avec
des types bien conçus ; on n'en fait pas un rituel.

### 1.5 Séparation des préoccupations

Chaque couche a un rôle, et **un seul** :

```
Rendu ─── Comportement ─── Données ─── Métier ─── Persistance
 JSX      hooks core      api-client   service    repository
```

Un composant qui appelle `fetch`, un service qui écrit du SQL, un repository qui applique une
règle de facturation : trois violations, trois refus en revue.

### 1.6 Autres principes appliqués

| Principe | Traduction concrète dans ShopNest |
|---|---|
| **Fail fast** | Les variables d'env sont validées au démarrage : l'app refuse de démarrer plutôt que de planter à la première requête |
| **Défaut sécurisé** | `getTenantIdOrThrow()` lève au lieu de renvoyer des données non filtrées ; une route sans `@Roles` explicite est refusée |
| **Moindre étonnement** | Une fonction nommée `getX` ne fait pas d'effet de bord ; `Dropdown` a les mêmes props sur web et mobile |
| **Loi de Déméter** | `order.customer.address.city` dans un composant est un signal : l'API doit renvoyer ce dont la vue a besoin |
| **Immutabilité par défaut** | `const` partout, pas de mutation de props ni de paramètres, `readonly` sur les types partagés |
| **Composition > héritage** | Aucune hiérarchie de classes en front ; en back, l'héritage se limite aux classes Nest |
| **Boy scout rule** | On laisse le fichier touché un peu plus propre qu'on l'a trouvé — sans transformer une PR de correction en refactor de 800 lignes |

---

## 2. Complexité temporelle et spatiale {#complexite}

Une plateforme multi-tenant amplifie chaque inefficacité : ce qui coûte 2 ms pour un vendeur
avec 20 produits en coûte 4 000 pour un vendeur Enterprise avec 40 000. **Le code doit être
écrit pour le plus gros tenant, pas pour le jeu de données de développement.**

### 2.1 La question à se poser systématiquement

Avant de valider une fonction ou une requête :

> *« Que se passe-t-il si `n` vaut 100 000 ? »*

Si la réponse est « ça devient lent », le code est à revoir maintenant. Si la réponse est
« ça sature la mémoire », c'est bloquant.

### 2.2 Complexités attendues

| Opération | Attendu | Inacceptable |
|---|---|---|
| Recherche d'un élément par clé | O(1) — `Map` / `Set` | O(n) — `array.find` dans une boucle |
| Jointure de deux listes | O(n + m) — index par `Map` | O(n × m) — `find` imbriqué |
| Tri | O(n log n) | O(n²) |
| Endpoint de liste | O(taille de page) | O(total des lignes du tenant) |
| Rendu d'une liste UI | O(éléments visibles) | O(tous les éléments) |
| Import CSV | O(1) en mémoire (flux) | O(n) — fichier entier en RAM |

### 2.3 Les pièges réels de ce projet

#### Recherche linéaire imbriquée — O(n × m)

```ts
// ❌ 500 commandes × 2 000 produits = 1 000 000 itérations
const enriched = orders.map(o => ({
  ...o,
  items: o.items.map(i => ({ ...i, product: products.find(p => p.id === i.productId) })),
}))

// ✅ O(n + m) — un index, puis des accès en O(1)
const productById = new Map(products.map(p => [p.id, p]))
const enriched = orders.map(o => ({
  ...o,
  items: o.items.map(i => ({ ...i, product: productById.get(i.productId) })),
}))
```

Règle mécanique : **un `find` / `includes` / `indexOf` à l'intérieur d'une boucle est un bug
de performance.** On construit une `Map` ou un `Set` avant la boucle.

#### N+1 requêtes SQL

Le problème de performance le plus fréquent en pratique, et le plus invisible en développement.

```ts
// ❌ 1 + 50 requêtes
const orders = await this.repo.findMany({ take: 50 })
for (const order of orders) {
  order.customer = await this.customers.findById(order.customerId)
}

// ✅ 1 requête
const orders = await this.prisma.order.findMany({
  take: 50,
  include: { customer: true, items: { include: { product: true } } },
})
```

Garde-fou en place : un intercepteur compte les requêtes SQL par requête HTTP et **échoue les
tests** au-delà de 5 (voir les budgets en §12). Ce n'est pas un warning qu'on ignore.

#### Pagination par offset sur grande table

```ts
// ❌ OFFSET 100000 force PostgreSQL à parcourir et jeter 100 000 lignes
prisma.product.findMany({ skip: 100_000, take: 20 })

// ✅ Curseur — O(log n) via l'index, temps constant quelle que soit la profondeur
prisma.product.findMany({
  take: 20,
  cursor: { id: lastId },
  skip: 1,
  orderBy: { createdAt: 'desc' },
})
```

Toutes les listes de l'API utilisent la pagination par curseur. L'offset n'est toléré que sur
des tables bornées (plans, catégories d'un tenant).

#### Index absents ou mal ordonnés

Une requête filtrant sur `(tenant_id, status, created_at)` a besoin d'un index composite dans
**cet ordre** — un index sur `status` seul est inutilisable ici.

```prisma
@@index([tenantId, status, createdAt])
```

Toute nouvelle requête filtrante s'accompagne d'un `EXPLAIN ANALYZE` en PR. `Seq Scan` sur une
table scopée = revue bloquée.

#### Agrégation en mémoire au lieu d'en base

```ts
// ❌ Charge 40 000 commandes en RAM pour calculer une somme
const orders = await this.repo.findMany({ where: { createdAt: { gte: start } } })
const total = orders.reduce((s, o) => s + o.totalCents, 0)

// ✅ La base agrège — mémoire O(1), et elle est faite pour ça
const { _sum } = await this.prisma.order.aggregate({
  where: { createdAt: { gte: start } },
  _sum: { totalCents: true },
})
```

Les statistiques du dashboard vendeur (§10.4 du cahier des charges) passent toutes par des
agrégations SQL, et les métriques coûteuses (MRR, churn) sont pré-calculées par un job nocturne.

#### Traitement de fichier en mémoire

L'import CSV de produits peut faire 50 Mo. Le charger entièrement fait tomber le worker.

```ts
// ❌ O(n) en mémoire
const rows = parse(await fs.readFile(path))

// ✅ O(1) en mémoire — flux + insertions par lots
await pipeline(
  createReadStream(path),
  csvParser(),
  batchTransform(500),
  async function* (batches) {
    for await (const batch of batches) await repo.createMany(batch)
  },
)
```

Même logique pour la génération de PDF, les exports et la réindexation Meilisearch : par lots,
en flux, jamais tout en mémoire.

#### Côté interface

```tsx
// ❌ Recalcul d'un tri O(n log n) à chaque frappe dans un champ sans rapport
const sorted = products.sort((a, b) => a.name.localeCompare(b.name))
// (et `sort` mute le tableau source — double faute)

// ✅ Mémoïsé, non mutant
const sorted = useMemo(() => [...products].sort(byName), [products])
```

- Les listes de plus de 100 lignes sont **virtualisées** : le coût de rendu devient O(lignes
  visibles) au lieu de O(total). Obligatoire sur le catalogue, les commandes, les clients.
- La recherche est **debouncée** (300 ms) : sans cela, taper « ordinateur » déclenche
  11 requêtes dont 10 inutiles. Géré une fois pour toutes dans `useAsyncOptions`
  (voir [07](./07-composants-dynamiques.md)).
- Les requêtes obsolètes sont **annulées** (`AbortSignal`) — sinon une réponse lente écrase
  une réponse récente.

### 2.4 Ordre de priorité

L'optimisation prématurée reste une erreur. L'ordre correct :

1. **Écrire du code correct et simple** (KISS).
2. **Éviter les fautes de complexité connues** — celles listées ci-dessus ne sont pas de
   l'optimisation, ce sont des erreurs à ne pas commettre. Écrire une `Map` au lieu d'un `find`
   imbriqué ne coûte rien de plus à l'écriture.
3. **Mesurer** avant d'optimiser autre chose : traces OpenTelemetry, React DevTools Profiler,
   `EXPLAIN ANALYZE`. Jamais à l'intuition.
4. **Optimiser** uniquement ce que la mesure désigne, et documenter pourquoi le code est devenu
   moins simple.

Autrement dit : on ne micro-optimise pas, mais on ne livre pas non plus un O(n²) en sachant
qu'il est là. Le premier est du gaspillage, le second est une dette qui explose au premier
gros tenant.

### 2.5 Vérifications en revue de code

- [ ] Aucun `find` / `includes` dans une boucle → `Map` ou `Set`
- [ ] Aucun `await` dans une boucle sur des opérations indépendantes → `Promise.all` (borné)
- [ ] Aucune requête SQL dans une boucle → `include` ou `IN (…)`
- [ ] Toute liste d'API est paginée par curseur
- [ ] Tout filtre a un index composite préfixé par `tenant_id`
- [ ] Les agrégations sont faites en base, pas en mémoire
- [ ] Les fichiers volumineux sont traités en flux
- [ ] Les listes UI longues sont virtualisées
- [ ] Les calculs coûteux sont mémoïsés, avec des dépendances justes

---

## 3. Nommage

### Fichiers et dossiers

| Type | Convention | Exemple |
|---|---|---|
| Dossier | `kebab-case` | `order-management/` |
| Composant React | `PascalCase.tsx` | `ProductCard.tsx` |
| Hook | `use-kebab-case.ts` | `use-product-list.ts` |
| Service / provider Nest | `kebab-case.service.ts` | `order.service.ts` |
| Type / schéma partagé | `kebab-case.contract.ts` | `product.contract.ts` |
| Test | `<fichier-testé>.spec.ts` | `order.service.spec.ts` |
| Test e2e | `<parcours>.e2e.ts` | `checkout.e2e.ts` |

Un fichier = un export principal. Le nom du fichier correspond au nom de cet export.

### Code

```ts
// Types et composants : PascalCase
type OrderStatus = 'pending' | 'paid' | 'shipped'
function ProductCard() {}

// Variables, fonctions, props : camelCase
const totalAmount = 0
function computeCartTotal() {}

// Constantes de module : SCREAMING_SNAKE_CASE
const MAX_PRODUCTS_BASIC_PLAN = 100

// Booléens : préfixe is / has / can / should
const isLoading = false
const hasNextPage = true
const canRefund = true

// Handlers : préfixe handle (interne) / on (prop)
function handleSubmit() {}
type Props = { onSubmit: () => void }

// Async : le nom dit ce qu'on obtient, pas qu'on attend
await fetchOrders()      // ✅
await getOrdersAsync()   // ❌
```

### Vocabulaire métier — à utiliser tel quel partout

| Terme | Signification | À ne pas confondre avec |
|---|---|---|
| `tenant` | Un vendeur et son espace isolé | `store`, `shop`, `merchant` |
| `storefront` | La boutique publique | `shop`, `site` |
| `customer` | Acheteur final d'un tenant | `user` |
| `user` | Compte authentifié quel que soit le rôle | `customer` |
| `plan` | Formule d'abonnement (Basic/Pro/Enterprise) | `subscription` |
| `subscription` | L'abonnement souscrit par un tenant | `plan` |
| `order` | Commande d'un customer | `purchase`, `transaction` |
| `payment` | Transaction financière liée à un order ou une subscription | `order` |

Ce tableau est contraignant : les tables, les DTO, les routes et les composants utilisent
ces mots. Un `ShopService` qui manipule des tenants est un bug de nommage à corriger.

## 4. TypeScript

**`strict: true` partout, sans exception.** Configuration héritée de `packages/config/tsconfig`.

```ts
// ❌ Interdit
function process(data: any) {}
const el = document.getElementById('x') as HTMLInputElement
// @ts-ignore

// ✅ À la place
function process(data: unknown) {
  const parsed = ProductSchema.parse(data)  // on valide, on ne suppose pas
}
const el = document.getElementById('x')
if (el instanceof HTMLInputElement) { /* … */ }
// @ts-expect-error — <raison explicite + lien vers l'issue>
```

Règles :

- `any` est interdit par ESLint (erreur, pas warning). `unknown` + validation à la place.
- `as` uniquement pour les `as const`. Un cast de type est un aveu qu'on ment au compilateur.
- Pas de types dupliqués entre back et front : ils viennent de `@shopnest/contracts` (DRY).
- Préférer les unions discriminées aux booléens multiples — **rendre les états invalides
  inexprimables** est la meilleure façon de ne pas avoir à les tester :

```ts
// ❌ 8 états possibles dont 5 sont invalides
type State = { isLoading: boolean; isError: boolean; data?: Product[] }

// ✅ 3 états, tous valides
type State =
  | { status: 'loading' }
  | { status: 'error'; error: AppError }
  | { status: 'success'; data: Product[] }
```

- Pas d'`enum` TypeScript (mauvaise interop, code émis inutile). Union de littéraux + `as const` :

```ts
export const ORDER_STATUS = ['pending', 'paid', 'shipped', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUS)[number]
```

- `readonly` sur les types exposés par les packages partagés : une consommation ne doit pas
  pouvoir muter une donnée partagée.

## 5. Gestion des erreurs

### Un type d'erreur unique, partagé

`packages/contracts/src/errors.ts` :

```ts
export type AppErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_FAILED'
  | 'PLAN_LIMIT_REACHED' | 'PAYMENT_FAILED' | 'TENANT_SUSPENDED'
  | 'RATE_LIMITED' | 'INTERNAL'

export interface AppError {
  code: AppErrorCode
  /** Message technique — journalisé, jamais affiché tel quel. */
  message: string
  /** Clé i18n du message destiné à l'utilisateur. */
  userMessageKey: string
  /** Erreurs par champ, pour les formulaires. */
  fields?: Record<string, string>
  /** Identifiant de corrélation pour retrouver la trace côté serveur. */
  traceId: string
}
```

Toutes les réponses d'erreur de l'API respectent ce format, produit par un `ExceptionFilter`
global. Les clients n'ont donc **qu'un seul format d'erreur à gérer** — application directe
de DRY sur la gestion d'erreur.

### Règles

- On ne masque jamais une erreur : pas de `catch {}` vide, pas de `catch { return null }`
  sans journalisation.
- On n'affiche jamais `error.message` à l'utilisateur : on affiche `t(error.userMessageKey)`.
- Le `traceId` est affiché à l'utilisateur sur les erreurs `INTERNAL` (« Code : a3f9c… »),
  pour que le support puisse retrouver la trace.
- Une erreur attendue (stock insuffisant, plan dépassé) est une valeur de retour, pas une
  exception. Les exceptions sont réservées à l'inattendu.

## 6. Design tokens {#design-tokens}

**Aucune valeur visuelle en dur.** Ni dans le web, ni dans le mobile.

```tsx
// ❌
<View style={{ padding: 16, backgroundColor: '#2563EB', borderRadius: 8 }} />
<div className="p-[16px] bg-[#2563EB]" />

// ✅ mobile
<View style={{ padding: spacing.md, backgroundColor: colors.brand.primary, borderRadius: radius.md }} />
// ✅ web (Tailwind configuré depuis les tokens)
<div className="p-md bg-brand-primary rounded-md" />
```

`packages/tokens` exporte des objets JS plateforme-agnostiques, consommés par la config
Tailwind côté web et directement côté React Native. Une couleur change à un seul endroit.
Détails dans [06 — Code partagé](./06-shared.md#tokens).

## 7. Structure interne d'un fichier

Ordre imposé, du plus général au plus spécifique :

```tsx
// 1. Imports — groupés : externes, packages @shopnest, internes (chemin relatif)
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { Product } from '@shopnest/contracts'
import { Button } from '@shopnest/ui-web'

import { useCart } from '../hooks/use-cart'

// 2. Types et constantes du module
interface ProductCardProps { /* … */ }
const IMAGE_RATIO = 4 / 3

// 3. L'export principal
export function ProductCard(props: ProductCardProps) { /* … */ }

// 4. Sous-composants et helpers privés, après leur utilisation
function PriceTag({ amount }: { amount: number }) { /* … */ }
```

Pas d'`export default`, sauf lorsqu'un outil l'impose (pages Expo Router, config Vite).
Les exports nommés sont refactorables et auto-complétables.

Taille : au-delà de **300 lignes** pour un fichier ou **50 lignes** pour une fonction, on se
demande sérieusement s'il n'y a pas deux responsabilités mélangées (SRP).

## 8. Commentaires

On commente **pourquoi**, jamais **quoi**.

```ts
// ❌ Incrémente le compteur
counter++

// ✅ MTN renvoie 200 avec un statut PENDING pendant ~30 s après l'initiation.
// On ne considère le paiement acquis qu'au webhook, sinon on crédite des commandes non payées.
if (response.status === 'PENDING') return { settled: false }
```

Un commentaire qui explique *quoi* fait le code signale généralement que le code n'est pas
assez clair : renommer plutôt que commenter (KISS).

Un `TODO` sans numéro d'issue est refusé en revue : `// TODO(#412): supporter les remises cumulables`.

## 9. Git

### Branches

```
main                 # production, protégée, tags de release
develop              # intégration, déployée sur staging
feat/<scope>-<sujet> # feat/checkout-mobile-money
fix/<scope>-<sujet>
chore/<sujet>
```

### Commits — Conventional Commits, en anglais

```
feat(orders): add partial refund support
fix(payment): make MTN webhook handler idempotent
perf(catalog): index products by id to avoid O(n²) enrichment
refactor(ui-web): extract Dropdown option source resolution
docs(architecture): document dependency boundaries
test(tenant): add cross-tenant isolation suite
```

Le scope correspond au module backend ou au package concerné.

### Pull requests

Une PR = un changement cohérent. Au-delà de ~400 lignes modifiées, on découpe.
Toute PR contient obligatoirement :

- la description du *pourquoi* (le *quoi* est dans le diff) ;
- les tests couvrant le changement ;
- la mise à jour de `doc/` si le changement contredit la documentation ;
- une capture avant/après pour tout changement visuel.

### Revue de code

Le relecteur vérifie, dans cet ordre :

1. **Isolation tenant** — la nouvelle requête peut-elle fuir entre tenants ?
2. **Complexité** — la checklist du §2.5 passe-t-elle ?
3. **Contrat de composant** — le composant respecte-t-il [07](./07-composants-dynamiques.md) ?
4. **Frontière de package** — le code est-il au bon endroit selon [01](./01-architecture.md) ?
5. **Principes** — duplication de connaissance, abstraction spéculative, responsabilité mélangée ?
6. Lisibilité, nommage, tests.

## 10. Dépendances

- Toute nouvelle dépendance runtime se justifie en PR : quel problème, quelle alternative
  interne, quel poids ajouté au bundle. Une dépendance de 40 ko pour une fonction de 10 lignes
  est un mauvais échange.
- Pas de librairie de composants tierce visible dans l'UI finale (MUI, Ant Design…) : le design
  system est à nous. Les librairies **headless** (Radix, `@tanstack/*`, `react-hook-form`) sont
  encouragées — elles fournissent le comportement, nous fournissons le rendu.
- Versions figées (pas de `^`) sur les dépendances critiques : Prisma, NestJS, Stripe.
- Renovate ouvre les PR de mise à jour ; les majeures sont traitées en tâche dédiée.

## 11. Sécurité — réflexes quotidiens

- Un secret ne se commite jamais. `.env` est dans `.gitignore`, `.env.example` est versionné
  avec des valeurs factices. `gitleaks` tourne en CI.
- Toute entrée est validée par un schéma Zod côté serveur, **même si le client valide déjà**.
- Toute action sensible (impersonation, changement de plan, suspension, remboursement) écrit
  une entrée d'audit avec l'acteur, la cible, l'ancienne et la nouvelle valeur.
- Aucune donnée personnelle ni identifiant dans une URL (query string) : ni email, ni token,
  ni numéro de téléphone.
- Les logs ne contiennent jamais : mot de passe, token, PAN de carte, numéro Mobile Money complet.
  Un `redactor` est appliqué au logger et sa liste de champs est testée.

## 12. Budgets de performance

Les principes du §2 sont vérifiés par des budgets chiffrés, contrôlés en CI :

| Métrique | Budget | Où |
|---|---|---|
| JS initial (gzip) | < 180 ko | `web-storefront` |
| LCP mobile 4G | < 2,5 s | `web-storefront` |
| Temps de réponse API p95 | < 300 ms | endpoints de lecture |
| Requêtes SQL par requête HTTP | ≤ 5 | tous endpoints |
| Mémoire d'un worker BullMQ | < 512 Mo | tous les jobs |
| Démarrage à froid mobile | < 2,5 s | Android d'entrée de gamme |

Un dépassement bloque la PR : c'est une décision explicite à prendre, pas une dérive
silencieuse. Le contournement existe (dérogation motivée en PR), mais il laisse une trace.
