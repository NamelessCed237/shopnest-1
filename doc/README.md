# Documentation ShopNest

Documentation technique de référence de la plateforme SaaS e-commerce multi-vendeurs ShopNest.

> Ces documents font autorité sur le code. Si le code diverge, c'est le code qu'on corrige,
> ou la doc qu'on met à jour dans la même PR. Jamais « on verra plus tard ».

## Sommaire

| # | Document | Contenu |
|---|---|---|
| 01 | [Architecture générale](./01-architecture.md) | Monorepo, applications, packages, flux de données, dépendances autorisées |
| 02 | [Conventions et bonnes pratiques](./02-conventions.md) | **KISS, DRY, YAGNI, SOLID**, **complexité temporelle et spatiale**, nommage, TypeScript, erreurs, Git, budgets |
| 03 | [Backend (NestJS)](./03-backend.md) | Structure modulaire, multi-tenant, Prisma, sécurité, jobs, paiement |
| 04 | [Frontend Web (React)](./04-frontend-web.md) | Structure des apps web, routing, état, data fetching, formulaires |
| 05 | [Mobile (React Native / Expo)](./05-mobile.md) | Structure, navigation, spécificités natives, ce qui se partage ou non |
| 06 | [Code partagé Web / Mobile](./06-shared.md) | Stratégie headless, packages `core`, `contracts`, `api-client`, `tokens` |
| 07 | [Composants dynamiques](./07-composants-dynamiques.md) | **Contrat obligatoire de tous les composants.** Cas de référence : `Dropdown` |
| 08 | [Tests et qualité](./08-tests-qualite.md) | Pyramide de tests, tests d'isolation multi-tenant, CI, définition de « terminé » |

## Par où commencer

- **Nouveau sur le projet** → 01, puis 02.
- **Tu vas écrire un composant UI** → 07 est obligatoire, il n'est pas optionnel.
- **Tu vas écrire un endpoint** → 03, section « Anatomie d'un module ».
- **Tu hésites entre mettre du code dans une app ou dans un package** → 01, section « Règle de placement ».

## Les 7 règles non négociables

1. **Aucune requête ne traverse la couche données sans `tenant_id`.** L'isolation est appliquée
   automatiquement par middleware, jamais à la main dans un service. Voir [03](./03-backend.md#isolation-multi-tenant).
2. **Aucun composant ne code en dur ses données.** Un composant reçoit une *source* de données,
   pas des données. Voir [07](./07-composants-dynamiques.md).
3. **Les types de l'API sont générés, jamais recopiés.** Le package `@shopnest/contracts`
   est la seule source de vérité. Voir [06](./06-shared.md#contracts).
4. **La logique se partage, le rendu ne se partage pas.** Web et mobile partagent des hooks
   headless, pas des composants visuels. Voir [06](./06-shared.md#strategie-headless).
5. **Pas de valeur visuelle en dur.** Couleurs, espacements, rayons, typographies viennent
   de `@shopnest/tokens`. Voir [02](./02-conventions.md#design-tokens).
6. **Une connaissance métier n'a qu'une seule représentation.** Une règle (limite de plan,
   validation, taux) est définie une fois dans `@shopnest/contracts` et importée partout.
   Voir [02](./02-conventions.md#principes).
7. **Le code est écrit pour le plus gros tenant, pas pour le jeu de données de dev.**
   Pas de `find` dans une boucle, pas de N+1, pas de pagination par offset, pas de fichier
   entier en mémoire. Voir [02](./02-conventions.md#complexite).
