import { randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

/**
 * Crée (ou répare) le rôle applicatif `shopnest_app` sur Supabase.
 *
 * Équivalent exécutable de `01-app-role.sql`, qui reste la référence commentée.
 * Ce script existe parce que le SQL brut oblige à écrire un mot de passe à la
 * main dans l'éditeur web : on le colle, on l'oublie, il finit dans un
 * presse-papier ou une capture d'écran. Ici le secret est tiré au sort, utilisé
 * une fois, affiché une fois — jamais écrit sur disque par ce script.
 *
 * Se connecte via DIRECT_URL : créer un rôle est une opération d'administration,
 * que le rôle applicatif n'a délibérément pas le droit de faire.
 *
 * Idempotent : relançable sans risque, il régénère alors le mot de passe.
 *
 *   pnpm --filter @shopnest/api db:provision
 */

const adminUrl = process.env.DIRECT_URL
if (!adminUrl) throw new Error('DIRECT_URL requis : la création de rôle passe par la connexion directe.')

const ROLE = 'shopnest_app'

/**
 * base64url et non base64 : le mot de passe part dans une URL de connexion.
 * Un `+` ou un `/` non échappé y casserait le parsing — panne intermittente et
 * pénible à diagnostiquer, puisqu'elle dépend du tirage.
 */
const password = randomBytes(32).toString('base64url')

const prisma = new PrismaClient({ datasourceUrl: adminUrl })

async function main(): Promise<void> {
  const [existing] = await prisma.$queryRaw<{ rolname: string }[]>`
    SELECT rolname FROM pg_roles WHERE rolname = ${ROLE}`

  /**
   * Le mot de passe n'est régénéré qu'à la CRÉATION du rôle.
   *
   * Ce script sert aussi à réparer des droits — ajouter un GRANT oublié, par
   * exemple. Faire tourner le mot de passe à chaque exécution obligerait à
   * réécrire le `.env` pour une correction qui n'a rien à voir, et couperait
   * l'application entre les deux. `ROTATE=1` force la rotation quand c'est
   * bien l'intention.
   */
  const rotate = !existing || process.env.ROTATE === '1'

  // Statement par statement : le protocole étendu de Prisma refuse plusieurs
  // requêtes dans un même appel.
  const statements = [
    ...(existing ? [] : [`CREATE ROLE ${ROLE} LOGIN`]),
    ...(rotate ? [`ALTER ROLE ${ROLE} LOGIN PASSWORD '${password}'`] : []),

    // Pas de `ALTER ROLE ... NOSUPERUSER NOBYPASSRLS` ici, contrairement à ce
    // qu'on écrirait spontanément : sur Supabase le rôle `postgres` n'est PAS
    // superuser, et PostgreSQL réserve aux superusers toute modification de
    // l'attribut SUPERUSER — y compris son RETRAIT. La requête échouerait sur
    // un « permission denied to alter role » trompeur.
    //
    // Ce n'est pas une perte : ces attributs sont désactivés par défaut à la
    // création. On les VÉRIFIE plus bas plutôt que de les imposer, ce qui est
    // de toute façon le contrôle qui compte.
    `ALTER ROLE ${ROLE} NOCREATEDB NOCREATEROLE`,

    `GRANT USAGE ON SCHEMA public TO ${ROLE}`,

    // Indispensable à l'ÉCRITURE, ce qui ne saute pas aux yeux : l'index
    // trigramme de `products` est bâti sur `immutable_unaccent()`, dont le
    // corps appelle `extensions.unaccent`. Chaque INSERT met l'index à jour,
    // donc exécute cette fonction — sans ce droit, toute création de produit
    // échoue sur un « permission denied for schema extensions », alors que les
    // lectures, elles, fonctionnent parfaitement.
    `GRANT USAGE ON SCHEMA extensions TO ${ROLE}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROLE}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLE}`,

    // Sans ces droits par défaut, chaque future migration créerait des tables
    // invisibles à l'application jusqu'à un GRANT manuel que personne ne pense
    // à faire — l'API tomberait après un déploiement pourtant « réussi ».
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ROLE}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${ROLE}`,
  ]

  for (const statement of statements) await prisma.$executeRawUnsafe(statement)

  const [role] = await prisma.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
    SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = ${ROLE}`

  if (!role) throw new Error(`Le rôle ${ROLE} est introuvable après création.`)
  if (role.rolsuper || role.rolbypassrls) {
    throw new Error(
      `${ROLE} a rolsuper=${role.rolsuper} rolbypassrls=${role.rolbypassrls} : la RLS serait ` +
        'contournée. Ces attributs ne peuvent être retirés que par un superuser — ' +
        'passer par le SQL Editor Supabase, ou supprimer puis recréer le rôle.',
    )
  }

  // L'hôte du pooler se déduit de DIRECT_URL : même projet, même région, seul
  // le port change (6543 = mode transaction).
  const parsed = new URL(adminUrl!)
  const host = parsed.host.replace(':5432', ':6543')

  // Le pooler (Supavisor) est mutualisé entre tous les projets : il identifie
  // le vôtre par le SUFFIXE du nom d'utilisateur, `<rôle>.<ref-projet>`. Sans
  // lui la connexion est rejetée sans le moindre message — d'où la déduction
  // depuis DIRECT_URL, qui porte déjà `postgres.<ref-projet>`.
  const projectRef = parsed.username.split('.')[1]
  if (!projectRef) {
    throw new Error(
      `DIRECT_URL a pour utilisateur « ${parsed.username} » : impossible d'en déduire la ` +
        'référence du projet. Attendu : postgres.<ref-projet>',
    )
  }

  if (!rotate) {
    console.warn(`
Rôle ${ROLE} à jour — droits réappliqués, mot de passe inchangé.
Aucune modification du .env n'est nécessaire.

Pour faire tourner le mot de passe : ROTATE=1 pnpm --filter @shopnest/api db:provision
`)
    return
  }

  console.warn(`
Rôle ${ROLE} prêt — rolsuper=false, rolbypassrls=false.

Reportez cette ligne dans le .env racine :

DATABASE_URL="postgresql://${ROLE}.${projectRef}:${password}@${host}/postgres?pgbouncer=true&connection_limit=1"

Le mot de passe n'est affiché qu'ici : rangez-le dans votre gestionnaire.
`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
