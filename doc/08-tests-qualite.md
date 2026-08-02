# 08 — Tests et qualité

## 1. Ce qu'on teste, et pourquoi

L'objectif n'est pas un pourcentage de couverture. C'est de pouvoir **modifier le code sans
peur**. On teste donc en priorité ce dont la casse est coûteuse :

| Priorité | Domaine | Justification |
|---|---|---|
| 🔴 Critique | Isolation multi-tenant | Une fuite = fin du projet |
| 🔴 Critique | Paiement, idempotence, webhooks | Double débit, perte financière |
| 🔴 Critique | Quotas de plan et facturation | Perte de revenu, litige client |
| 🟠 Élevée | Calculs de panier, remises, taxes | Erreurs silencieuses sur les montants |
| 🟠 Élevée | Authentification, RBAC | Escalade de privilèges |
| 🟡 Normale | Hooks de `@shopnest/core` | Partagés par toutes les apps |
| 🟢 Basse | Rendu visuel | Couvert par Storybook et la revue |

## 2. Pyramide

```
        ╱╲          E2E — quelques parcours critiques (Playwright / Maestro)
       ╱  ╲         · commander en carte  · commander en Mobile Money
      ╱    ╲        · créer un produit    · souscrire un plan
     ╱──────╲
    ╱        ╲      Intégration — modules backend sur base réelle
   ╱          ╲     · controller → service → repo → PostgreSQL de test
  ╱────────────╲
 ╱              ╲   Unitaire — logique pure et hooks
╱────────────────╲  · calculs, mappers, hooks de core, guards
```

Règle : **un test qui moque tout ne teste rien.** Les tests d'intégration backend tournent
sur un vrai PostgreSQL (Testcontainers), pas sur des mocks de Prisma.

## 3. La suite d'isolation multi-tenant

C'est la suite la plus importante du projet. Elle vit dans `apps/api/test/tenant-isolation/`
et bloque tout déploiement en cas d'échec.

```ts
describe('isolation multi-tenant', () => {
  let tenantA: Tenant, tenantB: Tenant

  beforeAll(async () => {
    tenantA = await seedTenant('alpha')
    tenantB = await seedTenant('beta')
    await seedProducts(tenantA, 5)
    await seedProducts(tenantB, 5)
  })

  it('un tenant ne lit jamais les produits d’un autre', async () => {
    const res = await asTenanant(tenantA).get('/products')
    expect(res.body.items).toHaveLength(5)
    expect(res.body.items.every(p => p.tenantId === tenantA.id)).toBe(true)
  })

  it('un accès direct par id à une ressource d’un autre tenant renvoie 404, pas 403', async () => {
    const productB = await getFirstProduct(tenantB)
    // 404 et non 403 : un 403 confirmerait l’existence de la ressource (fuite d’information)
    await asTenant(tenantA).get(`/products/${productB.id}`).expect(404)
  })

  it('un tenantId falsifié dans le corps de requête est ignoré', async () => {
    const res = await asTenant(tenantA)
      .post('/products')
      .send({ ...validProduct, tenantId: tenantB.id })
    expect(res.body.tenantId).toBe(tenantA.id)   // la valeur du client est écrasée
  })

  it('une requête sans contexte tenant est refusée, jamais servie sans filtre', async () => {
    await expect(TenantContext.run({} as never, () => prisma.product.findMany()))
      .rejects.toThrow('tenant context missing')
  })

  it('la RLS PostgreSQL bloque même une requête SQL brute', async () => {
    await setPgTenant(tenantA.id)
    const rows = await prisma.$queryRaw`SELECT * FROM products`
    expect(rows.every(r => r.tenant_id === tenantA.id)).toBe(true)
  })
})
```

Un test générique parcourt en plus **tous les modèles** ayant une colonne `tenantId` et vérifie
qu'ils figurent bien dans `TENANT_SCOPED_MODELS`. Ajouter une table scopée sans l'enregistrer
fait échouer la CI — c'est l'oubli le plus probable, il est donc rendu impossible.

## 4. Tests de paiement

```ts
it('rejoue un webhook sans créer un second paiement', async () => {
  const event = buildStripeWebhook('payment_intent.succeeded', { orderId })
  await postWebhook(event).expect(200)
  await postWebhook(event).expect(200)                  // rejeu

  const payments = await prisma.payment.findMany({ where: { orderId } })
  expect(payments).toHaveLength(1)
})

it('refuse un webhook dont la signature est invalide', async () => {
  await postWebhook(event, { signature: 'bogus' }).expect(401)
})

it('ne marque pas la commande payée sur la seule réponse du client', async () => {
  await asCustomer().post(`/orders/${orderId}/confirm-client-side`).expect(404)
})

it('gère l’expiration d’une confirmation Mobile Money', async () => {
  const payment = await initiateMomo()
  await advanceTime(minutes(3))
  await runJob('payments.expire-pending')
  expect(await getPayment(payment.id)).toMatchObject({ status: 'expired' })
  expect(await getOrder(payment.orderId)).toMatchObject({ status: 'payment_failed' })
})
```

Les prestataires sont remplacés par des **doubles de contrat** : des implémentations de
`PaymentProvider` qui reproduisent les comportements réels documentés (latence, statut
`PENDING` de MTN, rejeu de webhook), pas de simples `jest.fn()`.

## 5. Tests front

### Hooks de `@shopnest/core`

```ts
it('debounce la recherche et annule la requête précédente', async () => {
  const fetchOptions = vi.fn().mockResolvedValue({ options: [] })
  const { result } = renderHook(() => useAsyncOptions({ source: fetchOptions, lazy: false }))

  act(() => { result.current.setSearch('a') })
  act(() => { result.current.setSearch('ab') })
  act(() => { result.current.setSearch('abc') })

  await waitFor(() => expect(fetchOptions).toHaveBeenCalledTimes(1))
  expect(fetchOptions.mock.calls[0][0].search).toBe('abc')
})

it('vide la sélection quand une dépendance change', async () => { /* pays → ville */ })
```

Ces hooks sont testés **une seule fois** et le résultat couvre web et mobile.

### Composants

On teste le comportement utilisateur, jamais l'implémentation.

```tsx
it('permet de sélectionner une option au clavier', async () => {
  render(<Dropdown source={options} onChange={onChange} label="Statut" />)
  await user.tab()
  await user.keyboard('{Enter}{ArrowDown}{Enter}')
  expect(onChange).toHaveBeenCalledWith('active', expect.anything())
})

it('affiche un état d’erreur avec réessai quand la source échoue', async () => {
  render(<Dropdown source={() => Promise.reject(networkError)} label="Statut" />)
  await user.click(screen.getByRole('combobox'))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument()
})
```

```tsx
// ❌ Ne teste pas ça — c'est de l'implémentation, ça casse à chaque refactor
expect(wrapper.state().isOpen).toBe(true)
expect(container.querySelector('.dropdown-menu--open')).toBeTruthy()
```

### Storybook

Tout composant de `ui-web` / `ui-native` a une story **par état**, y compris chargement, erreur
et vide. Ces stories servent aussi de base aux tests de non-régression visuelle (Chromatic) et
aux contrôles d'accessibilité automatiques (addon a11y).

## 6. E2E

Parcours couverts, et uniquement ceux-là :

| Parcours | Plateforme |
|---|---|
| Inscription vendeur → création de boutique → premier produit publié | Web |
| Acheteur : catalogue → panier → paiement carte → confirmation | Web + Mobile |
| Acheteur : paiement Mobile Money avec confirmation asynchrone | Mobile |
| Vendeur : commande reçue → changement de statut → remboursement partiel | Web |
| Vendeur : changement de plan et blocage au dépassement de quota | Web |
| Super admin : suspension d'un tenant → storefront inaccessible | Web |

Ces tests tournent sur l'environnement `preview` de chaque PR. Ils sont peu nombreux
volontairement : lents et fragiles par nature, ils ne doivent couvrir que ce qui rapporte.

## 7. Pipeline CI

```yaml
# Sur chaque PR — bloquant
1. install (pnpm, cache)
2. lint          # eslint + prettier + boundaries entre packages
3. typecheck     # tsc --noEmit sur tout le monorepo
4. test:unit     # vitest — packages + apps
5. test:integration
6. test:tenant-isolation   # ⚠️ bloquant sans dérogation possible
7. build         # toutes les apps
8. size-limit    # budgets de bundle (voir 02)
9. gitleaks      # aucun secret commité
10. e2e          # sur l'environnement preview
```

Turborepo ne rejoue que ce qui dépend des fichiers modifiés. Une PR touchant `ui-native`
ne relance pas les tests backend.

## 8. Définition de « terminé »

Une tâche n'est terminée que si **tout** est vrai :

- [ ] Le code respecte les conventions de [02](./02-conventions.md)
- [ ] Le code est au bon endroit selon la règle de placement de [01](./01-architecture.md)
- [ ] Les tests couvrent le chemin nominal **et** les cas d'erreur
- [ ] Si le code touche à une donnée scopée : un test d'isolation existe
- [ ] Si le code touche au paiement : un test d'idempotence existe
- [ ] Les quatre états d'affichage sont traités sur tout écran de données
- [ ] Aucune valeur en dur : ni couleur, ni chaîne visible, ni URL, ni secret
- [ ] La documentation `doc/` est à jour si le changement la contredit
- [ ] Les budgets de performance sont respectés
- [ ] Testé au clavier (web) et sur un appareil réel d'entrée de gamme (mobile)

## 9. Dette technique

On l'assume explicitement plutôt que de la nier :

- Un raccourci assumé s'accompagne d'un commentaire `// DEBT(#issue): <raison, coût du remboursement>`.
- Un point de dette est ouvert en issue avec le label `debt` **au moment où on le crée**,
  jamais « plus tard ».
- 15 % de la capacité de chaque itération est réservée au remboursement de dette. Non
  négociable : c'est ce qui empêche la vélocité de s'effondrer au sixième mois.
