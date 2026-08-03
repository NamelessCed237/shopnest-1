import { PrismaClient } from '@prisma/client'

/**
 * Diagnostic de connexion Supabase.
 *
 * Répond à quatre questions qu'on se pose toujours au branchement, et dont les
 * réponses sont sinon dispersées entre le tableau de bord Supabase, le SQL
 * Editor et des messages d'erreur peu parlants :
 *
 *   1. Les deux URL joignent-elles la base ?
 *   2. Le rôle applicatif existe-t-il, et est-il bien soumis à la RLS ?
 *   3. Les tables scopées ont-elles des politiques FORCÉES ?
 *   4. Y a-t-il des données ?
 *
 * Lancer : pnpm --filter @shopnest/api db:check
 */

/** Masque tout ce qui pourrait fuiter dans un journal ou une capture d'écran. */
function redact(url: string | undefined): string {
  if (!url) return '(absente)'
  try {
    const parsed = new URL(url)
    return `${parsed.username ? `${parsed.username}@` : ''}${parsed.host}${parsed.pathname}`
  } catch {
    return '(illisible)'
  }
}

async function probe(label: string, url: string | undefined) {
  if (!url) {
    console.warn(`✗ ${label} : variable absente`)
    return undefined
  }

  const client = new PrismaClient({ datasourceUrl: url })
  try {
    await client.$queryRaw`SELECT 1`
    console.warn(`✓ ${label} : ${redact(url)}`)
    return client
  } catch (error) {
    console.warn(`✗ ${label} : ${redact(url)}`)
    console.warn(`  ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
    await client.$disconnect()
    return undefined
  }
}

async function main() {
  console.warn('--- Connexions ---')
  const app = await probe('DATABASE_URL (application)', process.env.DATABASE_URL)
  const direct = await probe('DIRECT_URL (migrations)', process.env.DIRECT_URL)

  const client = direct ?? app
  if (!client) {
    console.warn('\nAucune connexion utilisable : impossible de poursuivre le diagnostic.')
    process.exitCode = 1
    return
  }

  console.warn('\n--- Rôles ---')
  const roles = await client.$queryRaw<
    { rolname: string; rolsuper: boolean; rolbypassrls: boolean }[]
  >`SELECT rolname, rolsuper, rolbypassrls
    FROM pg_roles
    WHERE rolname IN ('postgres', 'shopnest_app')
    ORDER BY rolname`

  for (const role of roles) {
    const flags = [role.rolsuper && 'SUPERUSER', role.rolbypassrls && 'BYPASSRLS']
      .filter(Boolean)
      .join(', ')
    console.warn(`  ${role.rolname}${flags ? ` — ${flags}` : ' — aucun privilège d’élévation'}`)
  }

  if (!roles.some((role) => role.rolname === 'shopnest_app')) {
    console.warn(
      "  ⚠️  `shopnest_app` absent : jouer prisma/supabase/01-app-role.sql.\n" +
        '     Sans lui, l’application se connecte en `postgres`, qui IGNORE la RLS —\n' +
        '     la deuxième barrière d’isolation multi-tenant est alors inopérante.',
    )
  }

  console.warn('\n--- Row Level Security ---')
  const tables = await client.$queryRaw<
    { table_name: string; rls_active: boolean; rls_forcee: boolean; nb_politiques: bigint }[]
  >`SELECT c.relname AS table_name,
           c.relrowsecurity AS rls_active,
           c.relforcerowsecurity AS rls_forcee,
           count(p.polname) AS nb_politiques
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_policy p ON p.polrelid = c.oid
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns col
        WHERE col.table_schema = 'public'
          AND col.table_name = c.relname
          AND col.column_name = 'tenant_id')
    GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
    ORDER BY c.relname`

  const faibles = tables.filter((t) => !t.rls_active || !t.rls_forcee || t.nb_politiques === 0n)
  console.warn(`  ${tables.length} table(s) scopée(s), ${faibles.length} sans protection complète`)
  for (const table of faibles) {
    console.warn(
      `  ⚠️  ${table.table_name} — active:${table.rls_active} forcée:${table.rls_forcee} politiques:${table.nb_politiques}`,
    )
  }

  // Le contrôle qui compte vraiment. Tout le reste — RLS active, forcée,
  // politiques présentes, rôle sans BYPASSRLS — peut être vert alors que
  // l'isolation ne fonctionne pas : il suffit qu'une politique soit mal écrite.
  // Ici on interroge la base AVEC le rôle applicatif et on regarde ce qui sort.
  if (app) {
    console.warn("\n--- Isolation effective (rôle applicatif) ---")
    const [tenant] = await client.$queryRaw<{ id: string }[]>`
      SELECT id FROM tenants ORDER BY created_at LIMIT 1`

    if (!tenant) {
      console.warn('  (base vide : test ignoré)')
    } else {
      const sans = await app.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM products`
      const avec = await app.$transaction(async (tx) => {
        // `set_config(..., true)` = portée transaction : le pooler recycle les
        // connexions entre requêtes, un réglage persistant fuiterait d'un
        // tenant à l'autre.
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`
        return tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM products`
      })

      const fuite = sans[0]!.n > 0
      console.warn(`  sans contexte tenant : ${sans[0]!.n} produit(s) ${fuite ? '← FUITE' : '✓'}`)
      console.warn(`  avec contexte tenant : ${avec[0]!.n} produit(s)`)
      if (fuite) {
        console.warn('  ⚠️  L’absence de contexte donne accès aux données : ne pas déployer.')
        process.exitCode = 1
      }
    }
  }

  console.warn('\n--- Données ---')
  const [tenants, users, products] = await Promise.all([
    client.tenant.count(),
    client.tenantUser.count(),
    client.product.count(),
  ])
  console.warn(`  tenants: ${tenants} · utilisateurs: ${users} · produits: ${products}`)
  if (tenants === 0) console.warn('  → base vide : lancer `pnpm --filter @shopnest/api db:seed`')

  await client.$disconnect()
  if (app && app !== client) await app.$disconnect()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
