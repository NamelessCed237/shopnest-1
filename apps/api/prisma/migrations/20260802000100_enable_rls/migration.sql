-- doc/03 §3.4 — DEUXIÈME BARRIÈRE D'ISOLATION.
--
-- L'extension Prisma (première barrière) peut être contournée par une requête SQL
-- brute ou par un futur accès direct à la base. La Row Level Security, non.
-- Il faut que LES DEUX tombent pour qu'une fuite entre vendeurs se produise.
--
-- `app.tenant_id` est positionné par PrismaService.runWithRls() au début de chaque
-- transaction. `current_setting(..., true)` renvoie NULL si le paramètre est absent :
-- la politique refuse alors toutes les lignes — défaut sécurisé (doc/02 §1.6).

-- Fonction utilitaire : évite de répéter le cast dans chaque politique.
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

DO $$
DECLARE
  scoped_table TEXT;
BEGIN
  FOREACH scoped_table IN ARRAY ARRAY[
    'tenant_users',
    'products',
    'product_variants',
    'categories',
    'customers',
    'orders',
    'order_items',
    'payments'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', scoped_table);
    -- FORCE : la politique s'applique aussi au propriétaire de la table,
    -- sinon le rôle applicatif la contournerait sans le savoir.
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', scoped_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = current_tenant_id())
         WITH CHECK (tenant_id = current_tenant_id())',
      scoped_table
    );
  END LOOP;
END $$;

-- Rôle de maintenance (migrations, jobs inter-tenants du super admin) : il est le
-- SEUL à pouvoir contourner la RLS, et son usage est journalisé côté applicatif.
-- CREATE ROLE shopnest_maintenance BYPASSRLS;  -- à créer par l'infra, pas par la migration
