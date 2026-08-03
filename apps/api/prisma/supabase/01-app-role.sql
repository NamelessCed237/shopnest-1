-- ============================================================================
-- Rôle applicatif ShopNest — à exécuter UNE FOIS dans le SQL Editor Supabase.
-- ============================================================================
--
-- POURQUOI CE FICHIER N'EST PAS UNE MIGRATION PRISMA
--
-- Il crée un rôle avec un mot de passe. Une migration est versionnée dans git :
-- y écrire un secret le diffuserait à tout le dépôt (doc/02 §11). Ce script est
-- donc joué à la main, une seule fois, et le mot de passe ne quitte jamais
-- votre gestionnaire de mots de passe et votre fichier .env.
--
--
-- POURQUOI UN RÔLE DÉDIÉ PLUTÔT QUE `postgres`
--
-- Sur Supabase, le rôle `postgres` possède l'attribut BYPASSRLS : il ignore
-- purement et simplement les politiques de sécurité au niveau ligne. Si
-- l'application s'y connecte, la DEUXIÈME barrière d'isolation multi-tenant
-- (doc/03 §3.4) n'existe plus — elle est présente dans la base mais sans effet.
-- Il ne resterait que l'extension Prisma, et une seule requête SQL brute mal
-- écrite suffirait à faire fuir les données d'un vendeur vers un autre.
--
-- `shopnest_app` n'a ni BYPASSRLS, ni SUPERUSER, ni le droit de créer des
-- tables : il peut lire et écrire les données, rien de plus.
--
--
-- AVANT D'EXÉCUTER : remplacez le mot de passe ci-dessous.
-- Générez-le par exemple avec : openssl rand -base64 32

-- 1. Le rôle applicatif ---------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shopnest_app') THEN
    CREATE ROLE shopnest_app LOGIN PASSWORD 'REMPLACEZ_MOI';
  END IF;
END
$$;

-- Filet de sécurité : même si le rôle existait déjà avec des privilèges,
-- on retire explicitement ce qui rendrait la RLS inopérante.
ALTER ROLE shopnest_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- 2. Accès aux schémas ----------------------------------------------------
GRANT USAGE ON SCHEMA public TO shopnest_app;

-- Nécessaire à l'ÉCRITURE : l'index trigramme de `products` est bâti sur
-- `immutable_unaccent()`, dont le corps appelle `extensions.unaccent`. Chaque
-- INSERT met l'index à jour et exécute donc cette fonction. Sans ce droit, les
-- lectures marchent mais toute création échoue sur un « permission denied for
-- schema extensions ».
GRANT USAGE ON SCHEMA extensions TO shopnest_app;

-- Données : lecture et écriture, jamais la structure.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shopnest_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO shopnest_app;

-- Les tables créées par les FUTURES migrations doivent hériter des mêmes
-- droits, sinon chaque migration casserait l'application jusqu'à un GRANT
-- manuel que personne ne penserait à faire.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shopnest_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO shopnest_app;

-- 3. Vérification ---------------------------------------------------------
-- Doit renvoyer une ligne avec rolbypassrls = false et rolsuper = false.
SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
FROM pg_roles
WHERE rolname = 'shopnest_app';
