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
- **`connection_limit=10`** — et surtout **pas 1**, malgré ce que suggèrent la
  plupart des guides Supabase (écrits pour des fonctions serverless). Ici
  l'extension d'isolation enveloppe **chaque requête dans une transaction** :
  avec une seule connexion, deux requêtes concurrentes — le `Promise.all` du
  tableau de bord, par exemple — s'attendent mutuellement et échouent en
  `P2024 Timed out fetching a new connection`. Le message accuse le pool ; la
  cause est le blocage mutuel.
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

## 9 bis. Stockage des images produit

Les fichiers ne transitent **jamais** par l'API. Elle délivre un *ticket* — une
URL d'écriture signée, valable quinze minutes pour un seul chemin, un seul type
et une seule taille — et le navigateur téléverse directement vers le stockage.
Faire passer les octets par le backend paierait la bande passante deux fois et
monopoliserait un worker Node pendant tout l'envoi.

### Sans configuration : pilote local

En l'absence de `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`, l'API écrit dans
`apps/api/.storage` et sert les fichiers elle-même. Un dépôt fraîchement cloné
peut donc téléverser une image sans compte Supabase. Le pilote local reproduit
le même contrat — ticket signé, envoi direct, URL publique — pour que ce qui
fonctionne en local fonctionne en production.

`env.schema` le **refuse en staging et en production** : le disque d'un
conteneur disparaît au déploiement suivant, et les images avec lui.

### Avec Supabase Storage

1. *Storage → New bucket*, nom `product-images`, cocher **Public bucket** — une
   image produit s'affiche dans la boutique, sans session.
2. *Project Settings → API* : relever l'URL du projet et la clé `service_role`.
3. Renseigner `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et `STORAGE_BUCKET`.

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` contourne toute la RLS. Elle ne quitte jamais
> le backend : le navigateur ne reçoit qu'un ticket signé.

Les fichiers sont rangés sous `<tenantId>/<usage>/<uuid>.<ext>`. Le préfixe par
tenant rend l'appartenance lisible sur le chemin, permet de purger une boutique
fermée d'un seul appel, et laisse la porte ouverte à une politique de bucket par
préfixe. Le nom de fichier envoyé par le client n'est jamais repris — un UUID
tiré au sort écarte d'un coup la remontée de répertoire, la double extension et
l'écrasement accidentel.

### Ce qui n'est pas fait

Retirer une image d'une fiche **ne supprime pas le fichier** du stockage : il
devient orphelin. C'est délibéré pour l'instant — supprimer immédiatement
rendrait tout retour en arrière impossible, et une même URL peut avoir été
copiée ailleurs. Le ménage relève d'une tâche planifiée qui croise les clés du
bucket avec les `imageUrls` référencées ; elle reste à écrire.

## 9 ter. Paiements et tunnel d'achat

### Ce qui n'est jamais cru sur parole

Le panier vit dans le navigateur. Il affiche des montants ; **aucun n'est
transmis**. `CheckoutSchema` n'accepte que des identifiants de produit et des
quantités : prix, noms et disponibilité sont relus en base, et les totaux
recalculés. Un panier trafiqué ne change que ce que l'acheteur voit avant de
payer, jamais ce qu'il paie.

Le tenant vient du sous-domaine, jamais du corps de la requête — sans quoi un
appel choisirait la boutique qu'il souhaite débiter.

### Réservation de stock

Réservation et création de commande sont dans **une seule transaction**. La
décrémentation s'écrit `UPDATE … WHERE stock >= quantité` : la comparaison et
la soustraction sont la même instruction, donc deux commandes simultanées sur
le dernier article ne peuvent pas réussir toutes les deux. Un échec à n'importe
quel point annule tout — pas d'écriture de compensation, donc pas d'inventaire
faux le jour où la compensation échoue à son tour.

### Prestataires

Interface `PaymentProvider` : `initiate` et `parseWebhook`, rien d'autre. Un
paiement n'a que deux moments — on le déclenche, et on apprend plus tard ce
qu'il est devenu.

Sans clés, un **prestataire simulé** prend le relais. Il ne raccourcit rien : il
émet une vraie requête de webhook, signée, vers le vrai endpoint, qui la
déduplique dans la vraie table d'événements. Le jour où MTN est branché, seul
`simulated.provider.ts` est remplacé. Il est refusé hors développement.

Page de simulation : `GET /api/payments/simulator/:correlationId` — deux
boutons, payer ou échouer.

### Corrélation tenant ↔ paiement

Un webhook arrive sans session, sans en-tête et sans sous-domaine. Or `payments`
est protégée par la RLS : chercher le paiement sans savoir à quelle boutique il
appartient ne renvoie **rien, en silence**.

L'identifiant transporte donc le tenant : `<tenantId>.<uuid>`. Les trois
prestataires visés le permettent (MTN laisse fixer `X-Reference-Id`, Orange
accepte une référence marchand, Stripe des `metadata`). Pas de table de
correspondance, donc pas de seconde source de vérité à synchroniser.

### Suivi sans compte

L'acheteur invité reçoit un **laissez-passer** tiré au sort. Sans lui, le suivi
passerait par la référence — `CMD-02749`, séquentielle et lisible : la boutique
laisserait lire toutes ses ventes à qui sait compter.

### Ce qui n'est pas fait

- **Livraison et taxe restent à zéro.** Les colonnes existent, les montants
  circulent ; ce qui manque est une grille tarifaire par zone et un régime de
  TVA par pays. « Livraison gratuite » est une promesse commerciale, pas une
  valeur par défaut.
- **Le plan `enterprise` ne prélève aucune commission**, son taux étant négocié
  au cas par cas et pas encore stocké par boutique. Facturer un taux inventé
  serait pire que ne rien facturer.
- **Aucun courriel n'est envoyé.** L'écran annonce un récapitulatif ; il n'y a
  pas encore d'expéditeur. C'est le chantier « notifications ».
- **Le storefront n'a pas de routeur** : les étapes du tunnel n'ont pas d'URL.
  Voir le TODO(#8) de `main.tsx` — routage et rendu serveur vont ensemble.

## 10. Sauvegardes et coût

- Le **plan gratuit met le projet en pause après une semaine d'inactivité**.
  Pour une démonstration client, prévoyez une visite hebdomadaire ou le plan
  payant.
- Les sauvegardes automatiques ne sont pas incluses au plan gratuit. Avant
  toute manipulation risquée : *Database → Backups → Download*, ou
  `pg_dump` via `DIRECT_URL`.

## 11. Modules backend

Tous les domaines consommés par le dashboard sont désormais servis par l'API :

| Module | Routes |
|---|---|
| `auth` | connexion, rafraîchissement, déconnexion |
| `products` | liste, détail, création, modification, archivage, variantes |
| `categories` | liste arborescente, détail, CRUD |
| `orders` | liste, détail, transitions, remboursements |
| `customers` | liste, fiche, historique, répartition par segment |
| `analytics` | tuiles, série quotidienne, alertes de stock, ventilations |
| `billing` | plan, quotas consommés, relevé mensuel des commissions |
| `settings` | profil de la boutique, domaine personnalisé, équipe |
| `uploads` | ticket d'envoi signé (voir §9 bis) |
| `catalog` | vue publique du catalogue — actifs seuls, sans le stock exact |
| `checkout` | passage de commande et suivi par laissez-passer (voir §9 ter) |
| `payments` | initiation, webhooks signés, simulateur de développement |

`VITE_LIVE_DOMAINS` les liste tous. L'implémentation factice reste en place :
elle sert de mode démonstration hors ligne et de fixture aux tests.

### Ce que le mode factice ne pouvait pas révéler

Trois défauts n'apparaissent qu'avec une vraie base, et méritent d'être connus
avant d'ajouter un module :

- **Les requêtes brutes échappent à l'isolation.** `$queryRaw` court-circuite
  l'extension Prisma, donc personne ne positionne `app.tenant_id` : la RLS
  refuse alors toutes les lignes et la requête renvoie un résultat vide, sans
  la moindre erreur. Passer par `PrismaService.queryRawScoped()`.
- **Les transactions ne s'imbriquent pas.** L'extension enveloppe déjà chaque
  requête dans une transaction. Pour plusieurs écritures liées, utiliser
  `PrismaService.runInTenantTransaction()`.
- **Un contrat sans champ n'est pas un contrat sans besoin.** La liste des
  commandes affichait le nom de l'acheteur en le résolvant dans les fixtures ;
  l'API ne renvoyait que `customerId`. D'où `customerName`, joint côté serveur —
  sinon chaque ligne aurait déclenché une requête.
