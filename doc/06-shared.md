# 06 — Code partagé Web / Mobile

> Ce document répond à la question : *« qu'est-ce qui est écrit une seule fois pour les deux
> plateformes, et comment ? »*

## 1. Stratégie headless {#strategie-headless}

Le réflexe naturel est de vouloir partager les composants. C'est un piège : React Native Web
ou une abstraction `<Box>` maison mènent à un dénominateur commun médiocre — le web perd son
SEO et son contrôle CSS, le mobile perd ses gestes et ses animations natives.

La bonne frontière est ailleurs :

```
┌─────────────────────────────────────────────────────┐
│  COMPORTEMENT — partagé, écrit une seule fois       │
│                                                     │
│  • Quelles données charger, quand, avec quel cache  │
│  • Comment on filtre, trie, pagine, recherche       │
│  • Quelles règles métier s'appliquent               │
│  • Quel est l'état courant (ouvert, chargement…)    │
│  • Quelles props d'accessibilité en découlent       │
│                                                     │
│              packages/core  (hooks, zéro JSX)       │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┴───────────────┐
        ▼                              ▼
┌───────────────────┐        ┌────────────────────┐
│  RENDU WEB        │        │  RENDU NATIF       │
│  packages/ui-web  │        │ packages/ui-native │
│  div, Tailwind    │        │ View, StyleSheet   │
│  Radix, portails  │        │ Modal, Reanimated  │
└───────────────────┘        └────────────────────┘
```

**Un hook headless ne rend rien. Il calcule un état et renvoie des props.** Le composant web
et le composant natif consomment le même hook et se contentent de câbler ces props sur leurs
primitives respectives.

Gain observé : 60 à 80 % du code d'une fonctionnalité est partagé, sans compromis sur la
qualité du rendu de chaque plateforme.

## 2. `@shopnest/contracts` {#contracts}

**Source de vérité unique des types échangés entre le backend et tous les clients.**

```
packages/contracts/src/
├── primitives/
│   ├── money.ts            # { amountCents: number; currency: string }
│   ├── pagination.ts       # CursorPage<T>, CursorQuery
│   └── id.ts
├── errors.ts               # AppError, AppErrorCode  (voir 02)
├── entities/
│   ├── product.contract.ts
│   ├── order.contract.ts
│   ├── tenant.contract.ts
│   └── …
├── endpoints/              # signature de chaque route : entrée, sortie, méthode, chemin
│   └── products.endpoints.ts
└── index.ts
```

```ts
// entities/product.contract.ts
import { z } from 'zod'

export const ProductSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  price: MoneySchema,
  status: z.enum(['draft', 'active', 'archived']),
  stock: z.number().int().min(0),
  imageUrls: z.array(z.string().url()),
  createdAt: z.string().datetime(),
})
export type Product = z.infer<typeof ProductSchema>

// Le schéma de création dérive du schéma d'entité — jamais réécrit à la main
export const CreateProductSchema = ProductSchema
  .omit({ id: true, createdAt: true })
  .extend({ categoryIds: z.array(z.string().uuid()).default([]) })
export type CreateProductInput = z.infer<typeof CreateProductSchema>
```

Règles :

- Un type d'API n'existe **qu'ici**. Le backend l'importe, le web l'importe, le mobile l'importe.
- Le même schéma Zod valide côté serveur (pipe NestJS) et côté client (resolver React Hook Form).
  Une règle de validation change à un seul endroit.
- `contracts` ne dépend que de `zod`. Aucune dépendance React, Nest ou Prisma.
- Une modification cassante de contrat casse la compilation de toutes les apps immédiatement.
  **C'est l'intérêt principal du monorepo** : le bug apparaît en CI, pas en production.

## 3. `@shopnest/api-client`

Client HTTP typé, plateforme-agnostique, plus les hooks TanStack Query associés.

```ts
// packages/api-client/src/client.ts
export interface ApiClientConfig {
  baseUrl: string
  /** Fourni par la plateforme : localStorage (web) ou SecureStore (mobile). */
  tokenStorage: TokenStorage
  /** Résolution du tenant : sous-domaine (web) ou sélection explicite (mobile). */
  getTenantId: () => string | undefined
  onUnauthenticated: () => void
}

export function createApiClient(config: ApiClientConfig) { /* … */ }
```

L'injection de la configuration est ce qui rend le package partageable : il ne connaît ni
`window`, ni `AsyncStorage`, ni la navigation. Chaque application l'instancie avec ses propres
adaptateurs.

```ts
// apps/web-dashboard/src/lib/api.ts
export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL,
  tokenStorage: webTokenStorage,
  getTenantId: () => resolveTenantFromSubdomain(),
  onUnauthenticated: () => router.navigate({ to: '/login' }),
})

// apps/mobile/src/lib/api.ts
export const api = createApiClient({
  baseUrl: Config.apiUrl,
  tokenStorage: secureTokenStorage,
  getTenantId: () => useTenantStore.getState().tenantId,
  onUnauthenticated: () => router.replace('/auth/login'),
})
```

Le package fournit aussi, une seule fois pour les deux plateformes :

- le rafraîchissement de token avec file d'attente (une seule requête de refresh même si dix
  appels échouent simultanément) ;
- la normalisation des erreurs vers `AppError` ;
- les `queryKeys` centralisées ;
- les hooks de données génériques (`useProducts`, `useOrder`, `useCreateOrder`…).

## 4. `@shopnest/core`

Toute la logique front réutilisable. **Contrainte absolue : aucun JSX, aucun import de
`react-dom` ou de `react-native`.** Seuls `react` (pour les hooks) et les packages amont
sont autorisés. Un test de CI vérifie cette contrainte.

```
packages/core/src/
├── cart/
│   ├── use-cart.ts               # ajout, retrait, quantités, totaux, remises
│   └── cart-calculations.ts      # fonctions pures, testées unitairement
├── checkout/
│   └── use-checkout-flow.ts      # machine d'états du tunnel de commande
├── catalog/
│   ├── use-product-filters.ts    # filtres + tri + pagination infinie
│   └── use-product-search.ts     # recherche avec debounce
├── auth/
│   └── use-session.ts
├── forms/
│   └── use-app-form.ts           # RHF + Zod + réinjection des erreurs serveur
└── ui-state/                     # ⭐ les hooks headless des composants — voir 07
    ├── use-select.ts
    ├── use-async-options.ts
    ├── use-data-table.ts
    ├── use-disclosure.ts
    └── use-pagination.ts
```

Exemple d'un hook partagé — même code exact sur les deux plateformes :

```ts
// core/checkout/use-checkout-flow.ts
export function useCheckoutFlow() {
  const [step, setStep] = useState<CheckoutStep>('address')
  const { items, total } = useCart()
  const createOrder = useCreateOrder()

  const canGoNext = useMemo(() => validateStep(step, formState), [step, formState])

  async function submit(paymentMethod: PaymentMethod) {
    const order = await createOrder.mutateAsync({ items, paymentMethod })
    // Mobile Money : le paiement n'est pas acquis à la réponse HTTP.
    // On passe en attente de confirmation, la suite arrive par webhook.
    if (order.payment.status === 'awaiting_confirmation') {
      setStep('awaiting_confirmation')
      return
    }
    setStep('confirmation')
  }

  return { step, items, total, canGoNext, submit, isSubmitting: createOrder.isPending }
}
```

Le web l'affiche dans un tunnel en une page, le mobile dans une pile d'écrans. La logique,
les règles et les états sont identiques — donc corrigés une seule fois.

## 5. `@shopnest/tokens` {#tokens}

Valeurs de design exportées en JavaScript pur, consommables par Tailwind **et** par React Native.

```ts
// packages/tokens/src/index.ts
export const colors = {
  brand:   { primary: '#2563EB', primaryHover: '#1D4ED8', onPrimary: '#FFFFFF' },
  surface: { base: '#FFFFFF', raised: '#F8FAFC', overlay: 'rgba(15,23,42,0.6)' },
  text:    { primary: '#0F172A', secondary: '#475569', disabled: '#94A3B8' },
  status:  { success: '#16A34A', warning: '#D97706', danger: '#DC2626', info: '#0284C7' },
} as const

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 } as const
export const radius  = { sm: 4, md: 8, lg: 16, full: 9999 } as const
export const fontSize = { xs: 12, sm: 14, base: 16, lg: 18, xl: 24, '2xl': 32 } as const
export const duration = { fast: 150, normal: 250, slow: 400 } as const
```

```ts
// apps/web-dashboard/tailwind.config.ts — aucune valeur en dur ici non plus
import { colors, spacing, radius, fontSize } from '@shopnest/tokens'

export default {
  theme: {
    extend: {
      colors,
      spacing: mapToRem(spacing),
      borderRadius: mapToRem(radius),
      fontSize: mapToRem(fontSize),
    },
  },
}
```

```tsx
// apps/mobile — les mêmes valeurs, directement
import { colors, spacing, radius } from '@shopnest/tokens'
<View style={{ padding: spacing.md, backgroundColor: colors.surface.raised, borderRadius: radius.md }} />
```

Les tokens portent des noms **sémantiques** (`text.secondary`), pas descriptifs (`gray500`).
C'est ce qui permet d'introduire un mode sombre ou un thème par tenant sans toucher aux
composants : seule la table de correspondance change.

Le thème par tenant (couleur de marque, logo, rayons) est fourni au démarrage par l'API et
fusionné avec les tokens par défaut — même mécanisme sur les deux plateformes.

## 6. `@shopnest/i18n`

- Fichiers de traduction par locale, clés hiérarchiques.
- `formatMoney`, `formatDate`, `formatRelativeTime`, `formatNumber` basés sur `Intl`
  (disponible sur les deux plateformes ; polyfill Hermes déclaré côté mobile).
- Les clés d'erreur `AppError.userMessageKey` renvoyées par l'API résolvent dans ce catalogue :
  le backend ne renvoie jamais de texte destiné à l'utilisateur, seulement une clé.

## 7. `@shopnest/utils`

Fonctions pures uniquement, zéro dépendance framework, 100 % testées :
`slugify`, `debounce`, `groupBy`, `chunk`, `isDefined`, `assertNever`, `safeJsonParse`,
`buildQueryString`, `retryWithBackoff`.

Si une fonction a besoin de `window`, `document` ou d'une API React Native, elle ne va pas ici.

## 8. Comment décider où mettre un nouveau code

```
Le code contient-il du JSX ?
├── Non
│   ├── Utilise-t-il des hooks React ? ────── Oui ─→ packages/core
│   ├── Décrit-il une donnée d'API ? ──────── Oui ─→ packages/contracts
│   ├── Est-ce une valeur de design ? ─────── Oui ─→ packages/tokens
│   └── Sinon (fonction pure) ────────────────────→ packages/utils
│
└── Oui
    ├── Rend du DOM et sert à ≥ 2 apps web ? ─────→ packages/ui-web
    ├── Rend du natif et est réutilisable ? ──────→ packages/ui-native
    └── Sinon ────────────────────────────────────→ apps/<app>/src/…
```

**Règle de discipline :** quand tu écris un composant, demande-toi systématiquement *« quelle
partie de ce fichier serait identique en React Native ? »*. Cette partie appartient à
`packages/core`, pas au composant. C'est le réflexe qui fait que le partage existe réellement
au lieu de rester une intention.

## 9. Outillage

- Chaque package expose des points d'entrée explicites (`exports` dans son `package.json`) —
  pas de barrel géant qui casse le tree-shaking.
- Les packages ne sont pas pré-construits en développement : les apps consomment le TypeScript
  source (`main` → `src/index.ts`), ce qui donne un HMR instantané à travers les frontières.
- Turborepo met en cache builds, lint et tests par package : une PR ne reteste que ce qui
  dépend de ce qui a changé.
- Metro (mobile) est configuré avec `watchFolders` sur la racine du monorepo, sinon il ne
  résout pas les packages liés.
