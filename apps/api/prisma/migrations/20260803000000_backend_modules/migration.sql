-- Complète le schéma pour les modules `categories`, `orders`, `customers` et
-- `analytics`. Les colonnes ajoutées existaient déjà dans @shopnest/contracts :
-- c'est la base qui rattrapait son retard sur le contrat, pas l'inverse.

-- 1. Catégories : description et ordre d'affichage --------------------------
ALTER TABLE categories ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

-- L'index portait sur (tenant_id, parent_id) ; le tri se fait toujours par
-- position à l'intérieur d'un parent, autant l'y inclure.
DROP INDEX IF EXISTS "categories_tenant_id_parent_id_idx";
CREATE INDEX "categories_tenant_id_parent_id_position_idx"
  ON categories (tenant_id, parent_id, position);

-- 2. Commandes : cumul des remboursements -----------------------------------
ALTER TABLE orders ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0;

-- Un remboursement ne peut jamais dépasser l'encaissement. La règle est aussi
-- appliquée côté service, avec un message utilisateur ; ici c'est le filet :
-- une requête SQL brute ou un futur script d'import ne peut pas la contourner.
ALTER TABLE orders ADD CONSTRAINT orders_refunded_within_total
  CHECK (refunded_cents >= 0 AND refunded_cents <= total_cents);

-- 3. Lignes de commande : déclinaison ---------------------------------------
-- Volontairement SANS clé étrangère : supprimer une variante ne doit pas rendre
-- une commande passée illisible (doc/03 §4).
ALTER TABLE order_items ADD COLUMN variant_id UUID;

-- 4. Idempotence des mutations client ---------------------------------------
CREATE TABLE idempotency_keys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL,
  key        TEXT NOT NULL,
  scope      TEXT NOT NULL,
  response   JSONB NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "idempotency_keys_tenant_id_scope_key_key"
  ON idempotency_keys (tenant_id, scope, key);
CREATE INDEX "idempotency_keys_tenant_id_created_at_idx"
  ON idempotency_keys (tenant_id, created_at);

-- La table porte un tenant_id : elle DOIT être soumise à la RLS comme les
-- autres, sinon `db:check` la signalerait — et une clé d'un vendeur pourrait
-- neutraliser la mutation d'un autre.
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON idempotency_keys
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- 5. Index de tri du tableau clients ----------------------------------------
-- La liste des clients trie par date de dernière commande et agrège par client ;
-- sans cet index, chaque ouverture de l'écran parcourt toutes les commandes du
-- vendeur (doc/02 §2.3).
CREATE INDEX "orders_tenant_id_customer_id_created_at_idx"
  ON orders (tenant_id, customer_id, created_at DESC);
