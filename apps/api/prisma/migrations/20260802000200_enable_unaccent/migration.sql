-- Recherche insensible aux accents.
--
-- `ILIKE` de PostgreSQL ignore la CASSE mais pas les DIACRITIQUES : sur un
-- catalogue français, chercher « ecran » ne trouve pas « Écran ». L'utilisateur
-- en conclut que le produit n'existe pas.
--
-- Le pendant côté client est `normalizeForSearch` (@shopnest/utils). Les deux
-- doivent rester alignés : sinon le mode démonstration et la production ne
-- filtrent pas de la même façon, et les écrans testés en dev mentent.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- `unaccent` est STABLE et non IMMUTABLE, donc inutilisable dans un index tel quel.
-- Ce wrapper le rend indexable — technique standard, sûre tant que le
-- dictionnaire unaccent n'est pas modifié en cours de vie de la base.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$ SELECT unaccent('unaccent', $1) $$;

-- Index trigramme sur le nom normalisé : la recherche « contient » reste
-- indexée. Sans lui, chaque frappe déclencherait un Seq Scan sur tout le
-- catalogue du tenant (doc/02 §2.3).
CREATE INDEX products_name_unaccent_trgm_idx
  ON products
  USING gin (immutable_unaccent(lower(name)) gin_trgm_ops);

CREATE INDEX categories_name_unaccent_trgm_idx
  ON categories
  USING gin (immutable_unaccent(lower(name)) gin_trgm_ops);
