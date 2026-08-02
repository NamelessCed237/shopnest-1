# 01 — Architecture générale

## 1. Principe directeur

ShopNest est un **monorepo**. Une seule base de code, plusieurs applications déployables,
un socle de packages partagés. Le but n'est pas « tout mettre au même endroit » mais :

- garantir qu'un changement de contrat d'API casse la compilation des clients **immédiatement**,
  au lieu de casser la production trois semaines plus tard ;
- partager la logique métier front entre web et mobile sans dupliquer ;
- déployer chaque application indépendamment.

Outillage : **pnpm workspaces** + **Turborepo** (cache de build et orchestration des tâches).

## 2. Arborescence racine

```
shopnest/
├── apps/                        # Applications déployables
│   ├── api/                     # Backend NestJS — REST + WebSocket
│   ├── web-storefront/          # Boutique publique (React + Vite) — SSR-ready
│   ├── web-dashboard/           # Back-office vendeur (React + Vite)
│   ├── web-admin/               # Back-office super admin (React + Vite)
│   ├── mobile/                  # Application acheteur (React Native / Expo)
│   └── desktop/                 # Electron — Phase 3, coquille autour de web-dashboard
│
├── packages/                    # Code partagé, jamais déployé seul
│   ├── contracts/               # Types + schémas Zod partagés API ↔ clients (source de vérité)
│   ├── api-client/              # Client HTTP typé + hooks TanStack Query
│   ├── core/                    # Logique front headless (hooks métier, machines d'état)
│   ├── ui-web/                  # Composants React DOM (design system web)
│   ├── ui-native/               # Composants React Native (design system mobile)
│   ├── tokens/                  # Design tokens (couleurs, espacements, typo) — plateforme-agnostique
│   │   └── tailwind/preset.js   # Les mêmes tokens exposés à Tailwind (côté web)
│   ├── i18n/                    # Traductions et formatage (dates, devises, nombres)
│   ├── utils/                   # Fonctions pures sans dépendance framework
│   └── config/                  # Configs partagées : eslint, tsconfig
│                                # (le preset Tailwind vit dans tokens/ : sinon config
│                                #  dépendrait de tokens, qui dépend de config → cycle)
│
├── infra/                       # Docker, compose, migrations d'infra, IaC
├── doc/                         # Cette documentation
├── .github/workflows/           # CI/CD
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## 3. Règle de placement

Avant d'écrire un fichier, réponds à cette question dans cet ordre :

| Question | Si oui → destination |
|---|---|
| Est-ce une fonction pure sans React ni Nest ? | `packages/utils` |
| Est-ce un type ou un schéma de validation d'un objet d'API ? | `packages/contracts` |
| Est-ce de la logique React sans aucun JSX (hook, machine d'état) ? | `packages/core` |
| Est-ce du JSX qui rend du DOM et sera réutilisé par ≥ 2 apps web ? | `packages/ui-web` |
| Est-ce du JSX React Native réutilisable ? | `packages/ui-native` |
| Est-ce spécifique à une seule application ? | `apps/<app>/src/…` |

**Par défaut, écris dans l'app.** On remonte dans un package au moment où un deuxième
consommateur apparaît, pas avant. Une abstraction créée pour un seul usage est presque
toujours la mauvaise abstraction.

## 4. Graphe de dépendances autorisé

```
                    ┌──────────────┐
                    │  contracts   │  ← ne dépend de RIEN (sauf zod)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐  ┌────────┐  ┌──────────┐
        │api-client│  │  utils │  │  tokens  │
        └────┬─────┘  └───┬────┘  └────┬─────┘
             │            │            │
             └──────┬─────┘            │
                    ▼                  │
              ┌──────────┐             │
              │   core   │  (headless) │
              └────┬─────┘             │
                   │        ┌──────────┘
        ┌──────────┼────────┴─────┐
        ▼                         ▼
  ┌──────────┐              ┌───────────┐
  │  ui-web  │              │ ui-native │
  └────┬─────┘              └─────┬─────┘
       │                          │
   apps/web-*                 apps/mobile
```

Règles strictes, vérifiées en CI par `eslint-plugin-boundaries` :

- `contracts` ne dépend de rien d'autre que `zod`. C'est le seul package importé par `apps/api`.
- `core` **ne contient aucun JSX** et n'importe ni `react-dom` ni `react-native`.
- `ui-web` ne peut pas importer `ui-native`, et réciproquement.
- Une app ne peut jamais importer une autre app.
- `apps/api` n'importe **que** `contracts` et `utils`. Il ne connaît ni React ni les tokens.

## 5. Flux de données de bout en bout

```
[ Client Web / Mobile / Desktop ]
        │
        │  1. Le composant appelle un hook de packages/core
        ▼
[ packages/core — hook headless ]
        │
        │  2. Le hook appelle packages/api-client (TanStack Query)
        ▼
[ packages/api-client ]
        │
        │  3. Requête HTTP typée par packages/contracts
        │     En-têtes : Authorization, X-Tenant-Id (ou sous-domaine)
        ▼
┌───────────────────────────────────────────────┐
│ apps/api — NestJS                             │
│                                               │
│  TenantResolverMiddleware                     │  résout le tenant, remplit AsyncLocalStorage
│         ▼                                     │
│  AuthGuard → RolesGuard → ThrottlerGuard      │
│         ▼                                     │
│  Controller (validation Zod ← contracts)      │
│         ▼                                     │
│  Service (logique métier, zéro SQL)           │
│         ▼                                     │
│  Repository → PrismaService                   │
│         ▼                                     │
│  Middleware Prisma : injection de tenant_id   │  ← isolation automatique, non contournable
└───────────────────┬───────────────────────────┘
                    ▼
     PostgreSQL  ·  Redis (cache/BullMQ)  ·  Meilisearch
```

Les événements temps réel (statut de commande, stock) remontent par Socket.io dans une room
nommée `tenant:<tenantId>` — jamais de room globale.

## 6. Découpage des applications web

Trois applications web distinctes plutôt qu'une seule avec des rôles conditionnels :

| App | Public | Contraintes principales |
|---|---|---|
| `web-storefront` | Acheteurs, non authentifiés | SEO, performance, poids du bundle critique |
| `web-dashboard` | Vendeurs authentifiés | Densité d'information, tableaux, formulaires |
| `web-admin` | Super admins | Volumétrie, outils d'audit, impersonation |

Justification : le storefront doit charger vite et être indexable ; embarquer le code du
back-office dans le même bundle est une erreur de performance. Le coût de séparation est
absorbé par `packages/ui-web` et `packages/core`.

## 7. Environnements

| Env | Usage | Base de données | Déploiement |
|---|---|---|---|
| `local` | Développement | Docker Compose | `pnpm dev` |
| `preview` | Une instance par PR | Base éphémère, seed | Automatique sur PR |
| `staging` | Recette, données anonymisées | Copie anonymisée de prod | Merge sur `develop` |
| `production` | — | — | Tag `v*` sur `main`, validation manuelle |

Aucune variable d'environnement en dur dans le code. Toute variable est déclarée et validée
au démarrage via un schéma Zod (`apps/api/src/config/env.schema.ts`) — l'application refuse
de démarrer si une variable manque, plutôt que de planter en production à la première requête.

## 8. Décisions d'architecture (ADR)

Les décisions structurantes sont consignées dans `doc/adr/NNNN-titre.md` au format :
contexte → décision → conséquences → alternatives écartées.

ADR déjà actées :

| N° | Décision | Résumé |
|---|---|---|
| 0001 | Monorepo pnpm + Turborepo | Cohérence des contrats, partage web/mobile |
| 0002 | Multi-tenant *shared DB + tenant_id* | Coût d'exploitation maîtrisé, migration schema-par-tenant possible |
| 0003 | Stratégie headless pour le partage web/mobile | Voir [06](./06-shared.md) |
| 0004 | 3 apps web séparées | Isolation des budgets de performance |

Toute décision qui modifie le graphe de dépendances ou la stratégie de stockage **exige un ADR**.
