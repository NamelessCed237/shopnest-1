# 05 — Mobile (React Native / Expo)

## 1. Positionnement

L'application mobile cible **l'acheteur** (parcours storefront : catalogue, panier, commande,
suivi, notifications push). Le back-office vendeur reste web et desktop — un tableau de gestion
de stock sur téléphone n'apporte rien, et le construire diluerait l'effort.

Une V2 pourra ajouter un mode « vendeur nomade » réduit (notifications de commande, changement
de statut, consultation du chiffre d'affaires). Ce n'est pas dans le périmètre initial.

Stack : **Expo (managed workflow)**, **Expo Router**, **TanStack Query**, **Zustand**,
**React Native Reanimated**, **expo-notifications**, **EAS Build / EAS Update**.

## 2. Structure

```
apps/mobile/
├── app.config.ts                 # config Expo, variables par environnement
├── eas.json
└── src/
    ├── app/                      # Expo Router — le routage suit l'arborescence
    │   ├── _layout.tsx           # providers globaux
    │   ├── (tabs)/
    │   │   ├── index.tsx         # accueil / catalogue
    │   │   ├── search.tsx
    │   │   ├── cart.tsx
    │   │   └── account.tsx
    │   ├── product/[id].tsx
    │   ├── checkout/
    │   │   ├── address.tsx
    │   │   ├── payment.tsx
    │   │   └── confirmation.tsx
    │   └── auth/
    │
    ├── features/                 # même découpage par domaine que le web
    │   ├── catalog/
    │   ├── cart/
    │   ├── checkout/
    │   └── orders/
    │
    ├── components/               # composants propres à l'app
    ├── lib/
    │   ├── notifications.ts
    │   ├── secure-storage.ts     # expo-secure-store — tokens
    │   └── deep-links.ts
    └── theme/                    # consomme @shopnest/tokens
```

La structure `features/` est **identique** à celle du web, volontairement : un développeur
passe d'une plateforme à l'autre sans réapprendre l'organisation, et le code qui mérite d'être
partagé se repère immédiatement (mêmes noms de dossiers de part et d'autre).

## 3. Ce qui se partage avec le web — et ce qui ne se partage pas

| Élément | Partagé ? | Où |
|---|---|---|
| Types et schémas d'API | ✅ Oui | `@shopnest/contracts` |
| Client HTTP, query keys, hooks de données | ✅ Oui | `@shopnest/api-client` |
| Logique métier front (panier, checkout, filtres) | ✅ Oui | `@shopnest/core` |
| Design tokens | ✅ Oui | `@shopnest/tokens` |
| Traductions et formatage | ✅ Oui | `@shopnest/i18n` |
| Fonctions pures | ✅ Oui | `@shopnest/utils` |
| **Composants visuels** | ❌ **Non** | `ui-web` / `ui-native`, séparés |
| Navigation | ❌ Non | Spécifique à chaque plateforme |
| Stockage des tokens | ❌ Non | `localStorage` vs `expo-secure-store` |

**Pourquoi ne pas partager les composants visuels :** React Native Web permettrait un rendu
unique, mais au prix d'un dénominateur commun médiocre — mauvais SEO, contrôle CSS dégradé,
et une UI mobile qui « sent le web ». On partage donc le **comportement** (hooks headless) et
on écrit deux rendus. Le détail de cette stratégie est en [06](./06-shared.md#strategie-headless).

En pratique, un écran mobile et son équivalent web partagent 60 à 80 % de leur code : tout
sauf le JSX.

```tsx
// apps/mobile — le hook est identique à celui du web
import { useProductFilters } from '@shopnest/core'

export default function CatalogScreen() {
  const { products, filters, setFilter, isLoading, loadMore } = useProductFilters()
  return (
    <FlatList
      data={products}
      renderItem={({ item }) => <ProductCard product={item} />}  // rendu natif
      onEndReached={loadMore}
      ListHeaderComponent={<FilterBar filters={filters} onChange={setFilter} />}
    />
  )
}
```

## 4. Spécificités mobiles à traiter explicitement

### Réseau instable

Le mobile fonctionne en 3G, en tunnel, en perte de connexion. Ce n'est pas un cas limite,
c'est le cas normal.

- Persistance du cache TanStack Query (`@tanstack/query-async-storage-persister`) : l'app
  affiche le dernier état connu au démarrage plutôt qu'un écran vide.
- Bandeau hors-ligne global (`@react-native-community/netinfo`).
- Le panier est persisté localement et réconcilié avec le serveur à la reconnexion.
- Les mutations critiques ne sont **pas** mises en file hors-ligne : on ne passe pas une
  commande « en différé ». On explique que la connexion est requise.

### Paiement Mobile Money

C'est le parcours le plus délicat de l'app :

1. L'utilisateur saisit son numéro et valide.
2. L'API initie le paiement ; le prestataire pousse une demande de code PIN **sur le téléphone**.
3. L'app entre en état `awaiting_confirmation` : écran dédié, instructions explicites
   (« Validez la demande reçue sur votre téléphone »), compte à rebours visible.
4. La confirmation arrive par WebSocket, avec un polling de secours toutes les 5 s.
5. Expiration explicite (~2 min) avec une action de reprise claire.

L'utilisateur peut quitter l'app pendant l'étape 2 (composeur USSD). L'état doit donc survivre
au passage en arrière-plan : il est persisté, et restauré au retour au premier plan.

### Notifications push

- Demande de permission **contextuelle**, jamais au premier lancement : on la demande après
  la première commande, au moment où « suivre ma commande » a du sens. Le taux d'acceptation
  est le double.
- Le token est envoyé au backend, associé au couple `(customerId, tenantId)`.
- Chaque notification porte un lien profond vers l'écran concerné.
- Catégories désactivables individuellement dans les réglages de l'app (suivi de commande,
  promotions, retour en stock).

### Sécurité

- Tokens dans `expo-secure-store` (Keychain / Keystore), **jamais** dans `AsyncStorage`.
- Aucun secret dans `app.config.ts` : tout ce qui est embarqué dans le bundle est public.
- Épinglage de certificat envisagé en V2 pour les écrans de paiement.
- Verrouillage biométrique optionnel à l'ouverture pour les comptes ayant un moyen de
  paiement enregistré.

### Contraintes de plateforme

- Zones sûres (`react-native-safe-area-context`) sur tous les écrans — encoches et barres
  gestuelles.
- Clavier : `KeyboardAvoidingView` sur tout écran avec saisie, comportement différent iOS/Android.
- Retour arrière matériel Android géré explicitement, notamment pendant le checkout.
- Cibles tactiles ≥ 44 pt.
- Listes toujours en `FlatList`/`FlashList`, jamais en `map()` dans une `ScrollView`.

## 5. Performance

- Images via `expo-image` (cache disque, transitions), avec dimensions explicites.
- `FlashList` de Shopify pour les longues listes produits.
- Animations en `react-native-reanimated` (thread UI) — pas d'`Animated` JS pour les gestes.
- Écran de démarrage masqué seulement quand les polices et le premier écran sont prêts.
- Budget : démarrage à froid < 2,5 s sur un appareil Android d'entrée de gamme. C'est la
  cible réelle des marchés visés, pas un iPhone récent.

## 6. Livraison

- **EAS Update** pour les correctifs JS (déploiement immédiat, sans passer par les stores).
- **EAS Build** pour toute modification native (nouvelle dépendance native, permissions, icônes).
- Canaux : `development` → `preview` (testeurs internes) → `production`.
- Versionnement : `version` sémantique visible utilisateur, `runtimeVersion` lié à la couche
  native — un correctif OTA ne peut jamais viser un runtime différent.

## 7. Checklist — nouvel écran mobile

- [ ] Toute la logique vient de `@shopnest/core` ; l'écran ne contient que du rendu
- [ ] Zone sûre respectée, testé avec encoche et barre gestuelle
- [ ] Comportement clavier vérifié sur iOS **et** Android
- [ ] Les quatre états sont traités (chargement, erreur, vide, succès)
- [ ] Comportement hors-ligne défini explicitement
- [ ] Liste virtualisée si elle peut dépasser 20 éléments
- [ ] Aucune valeur de couleur ou d'espacement en dur
- [ ] Retour arrière Android géré
- [ ] Testé sur un appareil Android d'entrée de gamme réel, pas seulement en simulateur
