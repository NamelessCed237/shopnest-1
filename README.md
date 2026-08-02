# ShopNest

Plateforme SaaS e-commerce multi-vendeurs — web, mobile, desktop, API.

Chaque vendeur (*tenant*) obtient une boutique en ligne complète — storefront public et
back-office — hébergée et gérée par ShopNest, facturée par abonnement. Positionnement
différenciant : intégration native des paiements Mobile Money en complément de la carte
bancaire et du virement.

## Documentation

**La documentation technique fait autorité : [`doc/`](./doc/README.md).**

À lire avant d'écrire du code : [architecture](./doc/01-architecture.md) ·
[conventions](./doc/02-conventions.md) · [composants dynamiques](./doc/07-composants-dynamiques.md).

## Démarrage

```bash
pnpm install
```

```bash
cp .env.example .env
```

```bash
pnpm infra:up
```

```bash
pnpm --filter @shopnest/api db:migrate && pnpm db:seed
```

```bash
pnpm dev
```

| Application | URL |
|---|---|
| API | http://localhost:3000/api |
| Storefront | http://localhost:5173 |
| Dashboard vendeur | http://localhost:5174 |
| Back-office admin | http://localhost:5175 |
| Mobile | `pnpm --filter @shopnest/mobile dev` |

Prérequis : Node ≥ 22, pnpm ≥ 9, Docker.

## Structure

```
apps/            api (NestJS) · web-storefront · web-dashboard · web-admin · mobile
packages/        contracts · api-client · core · ui-web · ui-native · tokens · i18n · utils · config
doc/             documentation technique de référence
infra/           docker-compose et infrastructure
```

Où placer un nouveau fichier : [doc/01 §3](./doc/01-architecture.md#3-règle-de-placement).

## Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | Lance toutes les applications |
| `pnpm typecheck` | Vérifie les types sur tout le monorepo |
| `pnpm lint` | ESLint, dont les frontières de packages |
| `pnpm test:unit` | Tests unitaires |
| `pnpm test:tenant-isolation` | **Suite critique** — bloque tout déploiement en cas d'échec |
| `pnpm build` | Build de toutes les applications |
| `pnpm db:studio` | Explorateur Prisma |

## Les 7 règles non négociables

Détail et justification dans [doc/README.md](./doc/README.md).

1. Aucune requête ne traverse la couche données sans `tenant_id`.
2. Aucun composant ne code en dur ses données — il reçoit une *source*.
3. Les types de l'API sont générés depuis `@shopnest/contracts`, jamais recopiés.
4. La logique se partage entre web et mobile, le rendu ne se partage pas.
5. Aucune valeur visuelle en dur — tout vient de `@shopnest/tokens`.
6. Une connaissance métier n'a qu'une seule représentation.
7. Le code est écrit pour le plus gros tenant, pas pour le jeu de données de dev.
