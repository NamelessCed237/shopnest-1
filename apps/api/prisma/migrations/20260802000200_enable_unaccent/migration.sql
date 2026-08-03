-- Recherche insensible aux accents.
--
-- `ILIKE` de PostgreSQL ignore la CASSE mais pas les DIACRITIQUES : sur un
-- catalogue français, chercher « ecran » ne trouve pas « Écran ». L'utilisateur
-- en conclut que le produit n'existe pas.
--
-- Le pendant côté client est `normalizeForSearch` (@shopnest/utils). Les deux
-- doivent rester alignés : sinon le mode démonstration et la production ne
-- filtrent pas de la même façon.

-- ⚠️ SUPABASE : les extensions sont installées dans le schéma `extensions`,
-- pas dans `public`. Sans ce search_path, ni `unaccent()` ni l'opérateur
-- `gin_trgm_ops` ne sont visibles, et la migration échoue avec un
-- « function unaccent(unknown, text) does not exist » peu parlant.
SET search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- `unaccent` est STABLE et non IMMUTABLE, donc inutilisable dans un index tel
-- quel. Ce wrapper le rend indexable — technique standard, sûre tant que le
-- dictionnaire unaccent n'est pas modifié en cours de vie de la base.
--
-- `SET search_path` est figé DANS la fonction : sans cela, son corps dépendrait
-- du search_path de l'appelant, et un index construit aujourd'hui pourrait
-- donner un résultat différent demain — ce qui corromprait silencieusement
-- l'index.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  SET search_path = public, extensions, pg_temp
AS $$ SELECT extensions.unaccent('extensions.unaccent', $1) $$;

-- Index trigramme sur le nom normalisé : la recherche « contient » reste
-- indexée. Sans lui, chaque frappe déclencherait un Seq Scan sur tout le
-- catalogue du tenant (doc/02 §2.3).
CREATE INDEX products_name_unaccent_trgm_idx
  ON products
  USING gin (public.immutable_unaccent(lower(name)) extensions.gin_trgm_ops);

CREATE INDEX categories_name_unaccent_trgm_idx
  ON categories
  USING gin (public.immutable_unaccent(lower(name)) extensions.gin_trgm_ops);
