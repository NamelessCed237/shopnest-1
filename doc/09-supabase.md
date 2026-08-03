# 09 — Supabase comme base de données

> Supabase joue ici **un seul rôle : PostgreSQL hébergé**. L'API NestJS reste
> la seule porte d'entrée des clients, et les règles métier restent dans le
> backend, pas dans la base. Ni Supabase Auth, ni PostgREST, ni le client
> `@supabase/supabase-js` ne sont utilisés.

## 1. Pourquoi ce découpage

Supabase expose une API REST automatique et un système d'authentification. Les
utiliser ferait gagner du temps aujourd'hui et coûterait cher ensuite :

| | Avec l'API auto de Supabase | Avec NestJS devant |
|---|---|---|
| Règles métier | Dans des politiques SQL et des triggers | Dans du TypeScript testé, partagé avec le front |
| Idempotence des paiements | À réimplémenter en PL/pgSQL | Déjà là ([doc/03 §6](./03-backend.md)) |
| Contrat d'API | Dicté par le schéma des tables | `@shopnest/contracts`, stable |
| Changer de base | Réécriture du client | Une chaîne de connexion |

Le choix retenu garde l'architecture de [doc/01](./01-architecture.md) intacte.
Supabase remplace le PostgreSQL Docker, rien d'autre.

## 2. Créer le projet

1. **console.supabase.com** → *New project*.
2. **Région** : la plus proche de vos utilisateurs. `eu-west-3` (Paris) pour
   l'Europe et l'Afrique de l'Ouest ; la latence base ↔ API compte plus que
   celle de l'utilisateur, les deux doivent donc être dans la même région.
3. **Mot de passe base** : générez-le et rangez-le dans un gestionnaire. Il
   n'apparaît qu'une fois et sert à `DIRECT_URL`.
4. Attendez la fin du provisionnement (~2 min).

## 3. Créer le rôle applicatif

**Étape la plus importante du document.** Sur Supabase, le rôle `postgres`
possède `BYPASSRLS` : il ignore les politiques de sécurité au niveau ligne. Si
l'API s'y connecte, la deuxième barrière d'isolation multi-tenant
([doc/03 §3.4](./03-backend.md)) est présente dans la base mais **sans aucun
effet**.

```bash
pnpm --filter @shopnest/api db:provision
```

Le script crée le rôle, tire un mot de passe au hasard, applique les droits,
vérifie que `rolsuper` et `rolbypassrls` valent bien `false`, puis affiche la
ligne `DATABASE_URL` à recopier. Le mot de passe n'est **affiché qu'une fois** et
n'est jamais écrit sur disque.

Il est rejouable : une seconde exécution réapplique les droits **sans** changer
le mot de passe — utile quand une migration ajoute une table. Pour faire tourner
le secret, `ROTATE=1` devant la commande.

[`01-app-role.sql`](../apps/api/prisma/supabase/01-app-role.sql) reste la
référence commentée, à jouer dans le SQL Editor si vous préférez.

> ⚠️ Ce que le SQL « évident » ne peut pas faire : `ALTER ROLE … NOSUPERUSER
> NOBYPASSRLS`. Sur Supabase, `postgres` n'est pas superuser, et PostgreSQL
> réserve aux superusers toute modification de l'attribut `SUPERUSER` — y
> compris son retrait. La requête échoue sur un « permission denied to alter
> role » déroutant. Ces attributs sont de toute façon désactivés par défaut :
> on les vérifie au lieu de les imposer.

## 4. Récupérer les deux chaînes de connexion

*Project Settings → Database → Connection string → **URI***.

Supabase en propose plusieurs ; il en faut **deux différentes** :

```bash
# Application — pooler, port 6543
DATABASE_URL="postgresql://shopnest_app.<ref-projet>:<mdp-app>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Migrations — connexion directe, port 5432
DIRECT_URL="postgresql://postgres.<ref-projet>:<mdp-postgres>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

Quatre détails qui font perdre des heures si on les rate :

- **Le suffixe `.<ref-projet>` dans le nom d'utilisateur** — le pooler est
  mutualisé entre tous les projets et n'identifie le vôtre que par là.
  `shopnest_app` tout court est rejeté **sans message d'erreur**.
- **N'utilisez pas `db.<ref-projet>.supabase.co:5432`** : cette connexion
  directe historique n'est plus jointe qu'en IPv6, et échoue sur la plupart des
  postes en « Can't reach database server ».

- **`pgbouncer=true`** — le pooler en mode transaction ne supporte pas les
  requêtes préparées nommées de Prisma. Sans ce paramètre : erreurs
  `prepared statement "s0" already exists`, intermittentes donc difficiles à
  reproduire.
- **`connection_limit=1`** — le plan gratuit plafonne les connexions ; sans
  limite, Prisma ouvre un pool et sature le projet.
- **`DIRECT_URL` obligatoire** — `prisma migrate` pose un verrou consultatif
  que le pooler ne relaie pas. Sans elle, la migration **se bloque sans
  message d'erreur**.

L'utilisateur de `DATABASE_URL` est `shopnest_app`, celui de `DIRECT_URL` est
`postgres` : les migrations ont besoin des droits DDL que l'application n'a
délibérément pas.

## 5. Configurer le projet

```bash
cp .env.example .env
```

Renseignez `DATABASE_URL`, `DIRECT_URL` et les quatre secrets JWT
(`openssl rand -base64 32` pour chacun).

`.env` est dans `.gitignore` — il ne doit jamais être commité.

## 6. Appliquer le schéma

```bash
pnpm --filter @shopnest/api db:generate
```

```bash
pnpm --filter @shopnest/api db:deploy
```

`db:deploy` (et non `db:migrate`) : `migrate deploy` applique les migrations
existantes sans en générer de nouvelle ni proposer de réinitialiser la base.
C'est la commande qu'on veut sur une base distante — `migrate dev` peut
proposer un `reset`, et une frappe trop rapide efface tout.

Puis les données de démonstration :

```bash
pnpm --filter @shopnest/api db:seed
```

## 7. Vérifier l'isolation

Ne sautez pas cette étape : c'est elle qui dit si la plateforme peut accueillir
un vrai client.

```bash
pnpm --filter @shopnest/api db:check
```

Le diagnostic sonde les deux connexions, les rôles, la RLS, puis — c'est le
contrôle qui compte — **interroge réellement `products` avec le rôle applicatif**
sans contexte tenant. Attendu : `0 produit(s) ✓`. Tout le reste peut être au vert
avec une politique mal écrite ; cette lecture-là, non.

Pour l'inspection manuelle, [`02-verify-isolation.sql`](../apps/api/prisma/supabase/02-verify-isolation.sql)
se joue dans le SQL Editor. Trois résultats attendus :

- toutes les tables à `tenant_id` ont `rls_active = true` **et**
  `rls_forcee = true` ;
- `shopnest_app` a `rolbypassrls = false` ;
- les deux compteurs de fuite renvoient **0**, y compris celui sans contexte
  tenant — l'absence de contexte ne doit pas donner un accès total.

## 8. Démarrer

```bash
pnpm --filter @shopnest/api dev
```

Puis basculer le dashboard sur l'API réelle, dans
`apps/web-dashboard/.env.development` :

```bash
VITE_LIVE_DOMAINS=auth,products
VITE_DEV_TENANT=alpha-electronics
```

`VITE_LIVE_DOMAINS` bascule **domaine par domaine** : les écrans dont le module
backend n'existe pas encore (doc/09 §11) continuent de tourner sur les fixtures.
Un drapeau global casserait quatre écrans sur six.

`VITE_DEV_TENANT` remplace le sous-domaine : un identifiant n'est unique que
dans sa boutique, et `localhost` n'en désigne aucune. Sans lui, l'API répond
« tenant context missing » dès l'écran de connexion. Le backend n'accepte
l'en-tête correspondant qu'en dehors de la production.

## 9. Ce qui change par rapport au développement en mode factice

| Aspect | Mode factice | Supabase |
|---|---|---|
| Persistance | Perdue au rechargement | Réelle |
| Latence | 400 ms simulés | Réseau, variable |
| Isolation tenant | Aucune (un seul tenant) | Deux barrières actives |
| Erreurs | Toujours le format `AppError` | Idem — le filtre NestJS normalise |

Les écrans n'ont **pas** été écrits contre le mode factice : ils sont écrits
contre `@shopnest/contracts`. C'est ce qui rend la bascule possible en changeant
un drapeau.

## 10. Sauvegardes et coût

- Le **plan gratuit met le projet en pause après une semaine d'inactivité**.
  Pour une démonstration client, prévoyez une visite hebdomadaire ou le plan
  payant.
- Les sauvegardes automatiques ne sont pas incluses au plan gratuit. Avant
  toute manipulation risquée : *Database → Backups → Download*, ou
  `pg_dump` via `DIRECT_URL`.

## 11. Ce qui reste à faire côté backend

Le dashboard consomme aujourd'hui bien plus d'endpoints que l'API n'en expose.
Seuls `auth`, `tenants` et `products` existent côté NestJS. Il manque, par ordre
d'utilité pour brancher les écrans existants :

| Module | Écrans concernés |
|---|---|
| `categories` | CRUD catégories, filtre produits |
| `orders` | Liste, détail, transitions, remboursements |
| `customers` | Liste, fiche, historique |
| `analytics` | Tuiles et graphique du tableau de bord |

Tant qu'ils n'existent pas, `apps/web-dashboard/src/lib/api.ts` continue de
pointer ces domaines sur l'implémentation factice, produits et authentification
mis à part.
