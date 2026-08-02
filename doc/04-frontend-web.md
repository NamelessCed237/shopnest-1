# 04 — Frontend Web (React)

S'applique aux trois applications web : `web-storefront`, `web-dashboard`, `web-admin`.
Elles ont la **même structure interne** — un développeur qui connaît l'une sait naviguer dans les autres.

## 1. Stack

| Besoin | Choix | Pourquoi |
|---|---|---|
| Build | Vite + TypeScript | Démarrage rapide, HMR, config simple |
| Routing | TanStack Router | Routes typées de bout en bout, chargement de données par route |
| État serveur | TanStack Query | Cache, invalidation, retry, pagination infinie |
| État client | Zustand | Minimal, pas de boilerplate, testable hors React |
| Formulaires | React Hook Form + Zod | Validation partagée avec le backend |
| Styles | Tailwind CSS configuré depuis `@shopnest/tokens` | Aucune couleur en dur |
| Primitives | Radix UI (headless) | Accessibilité offerte, rendu 100 % à nous |
| Tests | Vitest + Testing Library + Playwright | — |

## 2. Structure d'une application web

```
apps/web-dashboard/
├── index.html
├── vite.config.ts
├── tailwind.config.ts            # étend @shopnest/tokens, ne définit aucune valeur
└── src/
    ├── main.tsx
    ├── app/
    │   ├── router.tsx            # arbre de routes
    │   ├── providers.tsx         # QueryClient, i18n, thème, toasts, ErrorBoundary
    │   └── routes/               # une route = un dossier
    │       ├── _authenticated/
    │       │   ├── products/
    │       │   │   ├── index.route.tsx      # la page (assemblage uniquement)
    │       │   │   ├── $productId.route.tsx
    │       │   │   └── -components/         # composants privés à cette route
    │       │   └── orders/
    │       └── login.route.tsx
    │
    ├── features/                 # ⭐ Découpage principal : par domaine métier
    │   ├── products/
    │   │   ├── api/              # hooks de données (useProducts, useCreateProduct)
    │   │   ├── components/       # ProductTable, ProductForm, ProductStatusBadge
    │   │   ├── hooks/            # logique locale à la feature
    │   │   ├── model/            # types locaux, mappers, sélecteurs
    │   │   └── index.ts          # ⚠️ SEUL point d'entrée public de la feature
    │   ├── orders/
    │   ├── customers/
    │   └── billing/
    │
    ├── components/               # Composants génériques propres à CETTE app
    │   └── layout/               # AppShell, Sidebar, Topbar
    │
    ├── lib/                      # adaptateurs techniques (storage, analytics, dates)
    └── styles/
```

### Règles de découpage

- **On découpe par domaine métier, pas par type de fichier.** Un dossier `components/`
  contenant 80 composants sans rapport entre eux est ingérable.
- Une feature n'importe **jamais** l'intérieur d'une autre feature :
  `import { OrderStatusBadge } from '@/features/orders'` ✅,
  `from '@/features/orders/components/OrderStatusBadge'` ❌. Vérifié par ESLint.
- Si deux features ont besoin du même composant, il monte dans `components/` ou dans
  `@shopnest/ui-web` s'il est réutilisable par plusieurs apps.
- Un fichier `*.route.tsx` **assemble**, il ne contient pas de logique. Si une route dépasse
  ~80 lignes, la logique doit descendre dans une feature.

## 3. État — quatre catégories, quatre outils

C'est la source de confusion n°1 en React. La règle :

| Catégorie | Exemple | Outil | Interdit |
|---|---|---|---|
| **État serveur** | Liste de produits, commande | TanStack Query | Le copier dans un `useState` |
| **État d'URL** | Filtres, pagination, onglet actif | Search params du routeur | Le dupliquer dans un store |
| **État client global** | Panier invité, thème, sidebar ouverte | Zustand | Y mettre des données serveur |
| **État local** | Champ contrôlé, popover ouvert | `useState` | Le remonter « au cas où » |

```tsx
// ❌ Anti-pattern courant : recopier le serveur dans un state local
const { data } = useProducts()
const [products, setProducts] = useState([])
useEffect(() => setProducts(data ?? []), [data])   // désynchronisation garantie

// ✅ On dérive, on ne duplique pas
const { data: products = [] } = useProducts()
const visible = useMemo(() => products.filter(p => p.status === 'active'), [products])
```

**Les filtres vont dans l'URL.** Une liste filtrée doit être partageable par copier-coller
du lien et survivre à un rafraîchissement. C'est une exigence produit, pas un détail.

## 4. Data fetching

Toute lecture ou écriture passe par un hook de `features/*/api/`, jamais par un `fetch`
dans un composant.

```ts
// features/products/api/use-products.ts
import { useQuery } from '@tanstack/react-query'
import { api } from '@shopnest/api-client'
import type { ListProductsQuery } from '@shopnest/contracts'

export const productKeys = {
  all: ['products'] as const,
  list: (q: ListProductsQuery) => [...productKeys.all, 'list', q] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
}

export function useProducts(query: ListProductsQuery) {
  return useQuery({
    queryKey: productKeys.list(query),
    queryFn: ({ signal }) => api.products.list(query, { signal }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,   // pas de flash de vide en changeant de page
  })
}
```

Règles :

- **Query keys centralisées** par feature (objet `xxxKeys`). Une clé écrite à la main dans
  un composant rend l'invalidation impossible à maintenir.
- Toute mutation invalide explicitement les clés concernées :
  `queryClient.invalidateQueries({ queryKey: productKeys.all })`.
- Mise à jour optimiste réservée aux actions à faible risque (favori, réordonnancement).
  **Jamais sur un paiement ou un remboursement.**
- `signal` toujours propagé pour que les requêtes obsolètes soient annulées.
- Les listes utilisent la pagination par curseur du backend, exposée via `useInfiniteQuery`.

## 5. Formulaires

Un seul schéma Zod, partagé avec le backend :

```tsx
import { CreateProductSchema } from '@shopnest/contracts'

const form = useForm<CreateProductInput>({
  resolver: zodResolver(CreateProductSchema),
  defaultValues: { name: '', priceCents: 0, currency: 'EUR' },
})
```

- Validation à la soumission, puis au `blur` une fois le champ touché — jamais à chaque frappe
  (afficher « email invalide » après trois caractères est hostile).
- Les erreurs serveur par champ (`AppError.fields`) sont réinjectées via `form.setError`.
- Le bouton de soumission est désactivé pendant l'envoi et l'action est **idempotente**
  côté serveur : on protège contre le double-clic aux deux bouts.

## 6. Routing et chargement

```tsx
// Découpage de bundle par route, systématique
const ProductsRoute = createLazyRoute('/products')({ component: ProductsPage })
```

- Toute route est chargée en `lazy`. Le bundle initial ne contient que le shell et la route active.
- Les gardes d'authentification vivent dans les `beforeLoad` du routeur, pas dans les composants.
- Chaque route déclare un `pendingComponent` (skeleton) et un `errorComponent`.

## 7. Rendu — les états obligatoires

Tout écran qui affiche des données serveur gère **quatre** états. Un écran qui en oublie un
est incomplet, ce n'est pas un détail à traiter « plus tard » :

1. **Chargement** — skeleton reproduisant la forme du contenu, pas un spinner centré.
2. **Erreur** — message traduit + action de reprise (« Réessayer »).
3. **Vide** — explication + action principale (« Aucun produit. Créer votre premier produit »).
   Un tableau vide sans message est un bug d'expérience.
4. **Succès** — le contenu.

`@shopnest/ui-web` fournit `<AsyncBoundary>` qui impose ces quatre états :

```tsx
<AsyncBoundary
  query={productsQuery}
  loading={<ProductTableSkeleton rows={10} />}
  empty={<EmptyState title={t('products.empty.title')} action={<CreateProductButton />} />}
>
  {(products) => <ProductTable products={products} />}
</AsyncBoundary>
```

## 8. Accessibilité — minimum exigé

Non négociable, vérifié en CI (`eslint-plugin-jsx-a11y`, axe dans les tests Playwright) :

- Tout élément interactif est atteignable au clavier, dans un ordre logique.
- Focus visible, jamais supprimé (`outline: none` sans remplacement est interdit).
- Toute image porte un `alt` (vide si décorative).
- Tout champ a un `<label>` associé, pas seulement un `placeholder`.
- Contraste texte ≥ 4.5:1.
- Les modales piègent le focus et se ferment avec `Échap`.
- Les changements dynamiques importants (résultats de recherche, erreurs) sont annoncés
  via `aria-live`.

Radix couvre l'essentiel du comportement — raison pour laquelle il est imposé sur les
overlays (dialog, popover, dropdown, tooltip).

## 9. Performance

- `React.memo` uniquement après mesure. Une mémoïsation systématique coûte plus qu'elle ne rapporte.
- Les listes de plus de 100 lignes sont virtualisées (`@tanstack/react-virtual`).
- Images : `loading="lazy"`, dimensions explicites (évite le décalage de mise en page), formats modernes.
- Le storefront a un budget JS initial de 180 ko gzip, vérifié en CI.
- Pas d'import de package entier pour une fonction : `import debounce from 'lodash/debounce'`,
  ou mieux, la version maison dans `@shopnest/utils`.

## 10. Internationalisation

- Aucune chaîne visible en dur dans le JSX. Tout passe par `t('cle.hierarchique')`.
- Les clés sont hiérarchiques et stables : `products.form.priceLabel`.
- Montants formatés par `formatMoney(money, locale)` de `@shopnest/i18n` — jamais de
  concaténation manuelle avec un symbole de devise.
- Dates formatées relativement au fuseau de l'utilisateur ; l'API renvoie toujours de l'UTC ISO 8601.
- Support RTL prévu dès maintenant : espacements logiques (`ps-`/`pe-` plutôt que `pl-`/`pr-`).

## 11. Checklist — nouvel écran

- [ ] Route en chargement paresseux, avec `pendingComponent` et `errorComponent`
- [ ] Les quatre états sont traités (chargement, erreur, vide, succès)
- [ ] Les filtres et la pagination sont dans l'URL
- [ ] Aucune chaîne en dur, aucune couleur en dur
- [ ] Les composants respectent [07 — composants dynamiques](./07-composants-dynamiques.md)
- [ ] Navigable entièrement au clavier
- [ ] Testé en 375 px de large (mobile) et en mode sombre
- [ ] Aucune donnée serveur recopiée dans un `useState`
