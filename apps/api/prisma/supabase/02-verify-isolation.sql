-- ============================================================================
-- Vérification de l'isolation multi-tenant — à exécuter APRÈS les migrations
-- et le seed, dans le SQL Editor Supabase.
-- ============================================================================
--
-- Ce script ne modifie rien. Il répond à une seule question, celle qui décide
-- si la plateforme peut accueillir un vrai client : « un vendeur peut-il voir
-- les données d'un autre ? »
--
-- La suite automatisée (apps/api/test/tenant-isolation) teste la barrière
-- applicative. Ce script teste la barrière BASE, celle qui reste quand du SQL
-- brut contourne Prisma.

-- 1. Les politiques existent-elles, et sont-elles FORCÉES ? -----------------
-- `relforcerowsecurity` doit être `true` : sans lui, le propriétaire de la
-- table (celui qui joue les migrations) échapperait aux politiques.
SELECT
  c.relname                AS table_name,
  c.relrowsecurity         AS rls_active,
  c.relforcerowsecurity    AS rls_forcee,
  count(p.polname)         AS nb_politiques
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND EXISTS (
    SELECT 1 FROM information_schema.columns col
    WHERE col.table_schema = 'public'
      AND col.table_name = c.relname
      AND col.column_name = 'tenant_id'
  )
GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
ORDER BY c.relname;

-- 2. Le rôle applicatif est-il bien soumis à la RLS ? ----------------------
-- rolbypassrls doit être false. S'il est true, tout le reste est décoratif.
SELECT rolname, rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname IN ('postgres', 'shopnest_app');

-- 3. Test réel de fuite ----------------------------------------------------
-- On se met dans la peau de l'application, on déclare un tenant, et on vérifie
-- qu'aucune ligne d'un AUTRE tenant ne remonte.
--
-- ⚠️ À jouer dans une transaction : SET LOCAL n'a d'effet que dans celle-ci.
BEGIN;

SET LOCAL ROLE shopnest_app;

-- Remplacez par l'identifiant d'un tenant réel (voir la table tenants).
SET LOCAL app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- Doit renvoyer 0 : aucun produit visible hors du tenant déclaré.
SELECT count(*) AS fuites_produits
FROM products
WHERE tenant_id <> current_setting('app.tenant_id', true)::uuid;

-- Doit renvoyer 0 également : sans tenant déclaré, on ne voit RIEN.
-- (Défaut sécurisé : l'absence de contexte ne donne pas un accès total.)
SET LOCAL app.tenant_id = '';
SELECT count(*) AS produits_sans_contexte FROM products;

ROLLBACK;
