-- Tunnel d'achat : ce qu'il faut pour qu'une commande PUISSE naître.
--
-- Jusqu'ici les commandes n'existaient que par le seed. Rien ne permettait
-- d'en créer une : ni adresse de livraison, ni contact acheteur, ni moyen pour
-- un invité de suivre la sienne.

-- 1. Adresse de livraison, RECOPIÉE sur la commande -------------------------
--
-- Pas de table `addresses` : elle supposerait un carnet d'adresses, donc un
-- compte avant tout achat — l'inverse de ce que le tunnel doit permettre. Et
-- une adresse partagée serait réécrite par un déménagement, changeant après
-- coup la destination d'une commande déjà expédiée. Même raisonnement que
-- `order_items.product_name`, recopié pour la même raison.
--
-- JSONB et non des colonnes à plat : le format d'adresse varie d'un pays à
-- l'autre, et rien ici n'est filtré, trié ou joint — c'est un bloc qu'on lit
-- entier pour l'imprimer sur un bordereau.
ALTER TABLE orders ADD COLUMN shipping_address JSONB;

-- 2. Contact acheteur -------------------------------------------------------
-- Seul point de contact d'une commande passée sans compte.
ALTER TABLE orders ADD COLUMN email TEXT;

-- 3. Laissez-passer de suivi ------------------------------------------------
--
-- Sans lui, suivre une commande sans compte exigerait un endpoint ouvert par
-- référence. Les références sont séquentielles et lisibles : la boutique
-- laisserait lire toutes ses ventes à qui sait compter.
ALTER TABLE orders ADD COLUMN tracking_token TEXT;

-- L'index sert la seule requête de suivi (« ce jeton, quelle commande ? »).
-- UNIQUE parce qu'un jeton qui ouvrirait deux commandes serait un défaut, pas
-- une commodité — et l'unicité le rend impossible plutôt qu'improbable.
CREATE UNIQUE INDEX "orders_tracking_token_key" ON orders (tracking_token)
  WHERE tracking_token IS NOT NULL;

-- 4. Motif d'échec du paiement ----------------------------------------------
--
-- « Solde insuffisant » et « numéro inconnu » appellent deux réactions
-- différentes de l'acheteur ; un simple statut `failed` les confond, et le
-- vendeur qui reçoit l'appel n'a rien à répondre.
ALTER TABLE payments ADD COLUMN failure_reason TEXT;

-- 5. Le total doit rester la somme de ses parts ------------------------------
--
-- Contrainte et non simple test applicatif : le total est ce qui est débité.
-- Un service qui se tromperait d'un centime le ferait en silence, et l'écart
-- ne se verrait qu'au rapprochement bancaire, des semaines plus tard.
--
-- NOT VALID : les commandes du seed sont antérieures et n'ont pas à être
-- recalculées pour que la règle s'applique aux suivantes.
ALTER TABLE orders ADD CONSTRAINT orders_total_is_consistent
  CHECK (total_cents = subtotal_cents + shipping_cents + tax_cents - discount_cents)
  NOT VALID;
