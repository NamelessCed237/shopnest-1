# 03 — Backend (NestJS)

## 1. Structure de `apps/api`

```
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── config/                      # Configuration typée et validée au démarrage
│   │   ├── env.schema.ts            # Schéma Zod de TOUTES les variables d'env
│   │   └── config.module.ts
│   │
│   ├── common/                      # Transverse — aucune logique métier ici
│   │   ├── decorators/              # @CurrentUser, @Roles, @Public, @SkipTenant
│   │   ├── filters/                 # AllExceptionsFilter → format AppError
│   │   ├── guards/                  # JwtAuthGuard, RolesGuard, PlanLimitGuard
│   │   ├── interceptors/            # LoggingInterceptor, TransformInterceptor
│   │   ├── pipes/                   # ZodValidationPipe
│   │   └── errors/                  # AppException et sous-classes
│   │
│   ├── tenancy/                     # ⚠️ Cœur de l'isolation — voir §3
│   │   ├── tenant-context.ts        # AsyncLocalStorage
│   │   ├── tenant-resolver.middleware.ts
│   │   ├── tenant.guard.ts
│   │   └── tenancy.module.ts
│   │
│   ├── database/
│   │   ├── prisma.service.ts        # Client Prisma + extension d'isolation
│   │   └── database.module.ts
│   │
│   ├── modules/                     # Un dossier par domaine métier
│   │   ├── auth/
│   │   ├── tenants/
│   │   ├── plans/
│   │   ├── subscriptions/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── inventory/
│   │   ├── carts/
│   │   ├── orders/
│   │   ├── customers/
│   │   ├── payments/
│   │   │   ├── providers/           # stripe/, mtn/, orange/ — même interface
│   │   │   └── webhooks/
│   │   ├── invoicing/
│   │   ├── analytics/
│   │   ├── notifications/
│   │   ├── search/                  # Indexation Meilisearch
│   │   ├── storage/                 # Upload média (S3 compatible)
│   │   ├── audit/
│   │   └── admin/                   # Endpoints super admin uniquement
│   │
│   ├── jobs/                        # Workers BullMQ
│   │   ├── queues.ts
│   │   └── processors/
│   │
│   └── realtime/                    # Gateway Socket.io
│       └── events.gateway.ts
│
└── test/
    ├── e2e/
    └── tenant-isolation/            # Suite critique — voir 08
```

## 2. Anatomie d'un module

Chaque module suit **exactement** la même structure. Exemple `products` :

```
modules/products/
├── products.module.ts
├── products.controller.ts        # HTTP uniquement : parse, délègue, formate
├── products.service.ts           # Logique métier — zéro SQL, zéro objet HTTP
├── products.repository.ts        # Accès aux données — le seul à toucher Prisma
├── dto/
│   ├── create-product.dto.ts     # Dérivé des schémas de @shopnest/contracts
│   └── list-products.dto.ts
├── events/
│   └── product-created.event.ts
└── products.service.spec.ts
```

### Les 4 responsabilités, séparées strictement

```ts
// products.controller.ts — ne contient JAMAIS de logique métier
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Roles('tenant_admin', 'tenant_staff')
  async list(@Query(new ZodValidationPipe(ListProductsSchema)) query: ListProductsDto) {
    return this.products.list(query)
  }

  @Post()
  @Roles('tenant_admin')
  @UseGuards(PlanLimitGuard('products'))   // quota du plan vérifié en amont
  async create(@Body(new ZodValidationPipe(CreateProductSchema)) dto: CreateProductDto) {
    return this.products.create(dto)
  }
}
```

```ts
// products.service.ts — logique métier. Ne connaît ni HTTP ni Prisma.
@Injectable()
export class ProductsService {
  constructor(
    private readonly repo: ProductsRepository,
    private readonly events: EventEmitter2,
  ) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const existing = await this.repo.findBySlug(dto.slug)
    if (existing) {
      throw new AppException('VALIDATION_FAILED', 'slug already used', {
        fields: { slug: 'errors.product.slugTaken' },
      })
    }

    const product = await this.repo.create(dto)
    this.events.emit('product.created', new ProductCreatedEvent(product))
    return product
  }
}
```

```ts
// products.repository.ts — le SEUL endroit où Prisma apparaît
@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Aucun tenantId ici : il est injecté automatiquement. Voir §3.
  findBySlug(slug: string) {
    return this.prisma.product.findFirst({ where: { slug } })
  }
}
```

**Pourquoi cette séparation :** le jour où l'on passe d'une stratégie `shared DB + tenant_id`
à `schema par tenant` (§8.4 du cahier des charges), seuls les repositories changent.
Les services et controllers sont intacts.

## 3. Isolation multi-tenant

C'est la partie la plus critique du backend. Une erreur ici = fuite de données entre vendeurs.

### 3.1 Résolution du tenant

Un middleware s'exécute avant tout le reste, sur toutes les requêtes :

```ts
// tenancy/tenant-resolver.middleware.ts
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(private readonly tenants: TenantsService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Ordre de résolution :
    //   1. Sous-domaine       → boutique.shopnest.app        (storefront public)
    //   2. Domaine personnalisé → boutique.com               (plans Pro/Enterprise)
    //   3. Claim `tid` du JWT  → dashboard vendeur, mobile
    const tenantId = await this.resolve(req)

    if (!tenantId) return next()   // route globale (auth, plans publics, health)

    const tenant = await this.tenants.findActive(tenantId)
    if (!tenant) throw new AppException('NOT_FOUND', 'tenant not found')
    if (tenant.status === 'suspended') throw new AppException('TENANT_SUSPENDED', '…')

    TenantContext.run({ tenantId: tenant.id, plan: tenant.planCode }, next)
  }
}
```

### 3.2 Contexte porté par AsyncLocalStorage

```ts
// tenancy/tenant-context.ts
interface TenantStore {
  tenantId: string
  plan: PlanCode
  /** Vrai uniquement pour un super admin ayant explicitement demandé un accès inter-tenant. */
  crossTenant?: boolean
  /** Renseigné lors d'une impersonation — journalisé systématiquement. */
  impersonatedBy?: string
}

const als = new AsyncLocalStorage<TenantStore>()

export const TenantContext = {
  run: <T>(store: TenantStore, fn: () => T) => als.run(store, fn),
  get: () => als.getStore(),
  getTenantIdOrThrow(): string {
    const store = als.getStore()
    if (!store?.tenantId) {
      // Défaut sécurisé : en l'absence de contexte, on refuse la requête.
      // On ne renvoie JAMAIS de données non filtrées.
      throw new AppException('FORBIDDEN', 'tenant context missing')
    }
    return store.tenantId
  },
}
```

Aucun service ne reçoit `tenantId` en paramètre. Le contexte est ambiant : c'est ce qui
rend l'oubli impossible.

### 3.3 Injection automatique dans Prisma

```ts
// database/prisma.service.ts
const TENANT_SCOPED_MODELS = new Set([
  'Product', 'Category', 'Order', 'OrderItem', 'Customer', 'Cart',
  'Inventory', 'Discount', 'Review', 'Address', 'Invoice',
])
// Modèles globaux, volontairement exclus : Tenant, Plan, SuperAdmin, AuditLog, WebhookEvent

export class PrismaService extends PrismaClient {
  withTenantIsolation() {
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!TENANT_SCOPED_MODELS.has(model)) return query(args)

            const ctx = TenantContext.get()
            if (ctx?.crossTenant) return query(args)   // super admin, tracé en audit

            const tenantId = TenantContext.getTenantIdOrThrow()

            // Lectures et suppressions : on force le filtre
            if (READ_OPS.has(operation) || DELETE_OPS.has(operation)) {
              args.where = { ...args.where, tenantId }
            }
            // Écritures : on force la valeur, on n'accepte pas celle du client
            if (operation === 'create') {
              args.data = { ...args.data, tenantId }
            }
            if (operation === 'createMany') {
              args.data = toArray(args.data).map((d) => ({ ...d, tenantId }))
            }
            if (UPDATE_OPS.has(operation)) {
              args.where = { ...args.where, tenantId }
            }
            return query(args)
          },
        },
      },
    })
  }
}
```

### 3.4 Deuxième filet : Row Level Security PostgreSQL

Le middleware applicatif peut être contourné par une requête SQL brute. On active donc
**RLS en base** sur toutes les tables scopées :

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

`PrismaService` positionne `app.tenant_id` au début de chaque transaction. Deux barrières
indépendantes : il faut que les deux tombent pour qu'une fuite se produise.

### 3.5 Accès super admin

L'accès inter-tenant n'est **jamais** implicite :

```ts
@Get('tenants/:id/orders')
@Roles('super_admin')
@CrossTenant()            // décorateur explicite, sinon la requête est filtrée
@Audited('admin.orders.read')
async listTenantOrders(@Param('id') tenantId: string) { /* … */ }
```

Le décorateur `@Audited` écrit systématiquement dans `audit_logs`. Une impersonation sans
entrée d'audit est un bug bloquant.

### 3.6 Règles

- ❌ Ne jamais écrire `tenantId` à la main dans un `where` de service.
- ❌ Ne jamais utiliser `prisma.$queryRaw` sans clause tenant explicite **et** revue dédiée.
- ❌ Ne jamais faire confiance à un `tenantId` venu du corps de requête ou d'un paramètre client.
- ✅ Tout nouveau modèle scopé s'ajoute à `TENANT_SCOPED_MODELS` **et** à la suite de tests
  d'isolation. La CI échoue si un modèle possède une colonne `tenantId` absente du Set.

## 4. Base de données

### Conventions Prisma

```prisma
model Product {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  slug      String
  name      String
  priceCents Int     @map("price_cents")   // ⚠️ toujours des entiers, jamais de Float
  currency  String   @db.Char(3)           // ISO 4217
  status    String   @default("draft")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")   // soft delete

  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, slug])               // unicité TOUJOURS scopée au tenant
  @@index([tenantId, status, createdAt])   // index composite préfixé par tenant_id
  @@map("products")
}
```

Règles :

- Tables et colonnes en `snake_case` (`@map`), modèles Prisma en `PascalCase`.
- **Montants en entiers de centimes**, jamais en flottant. Le type `Money` de `contracts`
  transporte `{ amountCents: number; currency: string }`.
- Tout index sur une table scopée commence par `tenant_id`.
- Toute contrainte d'unicité métier est `@@unique([tenantId, …])`.
- Soft delete via `deletedAt` sur les entités référencées par des commandes (on ne casse
  jamais l'historique d'une commande en supprimant un produit).
- Dates en UTC en base. La conversion en fuseau local se fait à l'affichage.

### Migrations

- Une migration par PR, jamais éditée après merge.
- Migration destructive (drop de colonne) en **deux temps** : d'abord on arrête d'écrire
  (release N), ensuite on supprime (release N+1). Sinon un rollback casse la production.
- Le seed (`prisma/seed.ts`) crée 2 tenants de démonstration avec des données croisées :
  il sert aussi de fixture aux tests d'isolation.

## 5. Sécurité applicative

### Authentification

Trois audiences JWT distinctes, avec des secrets et durées différents :

| Audience | Access token | Refresh token | Contenu du claim |
|---|---|---|---|
| `customer` | 15 min | 30 j | `sub`, `tid`, `aud: customer` |
| `tenant_user` | 15 min | 7 j | `sub`, `tid`, `role`, `aud: tenant` |
| `super_admin` | 10 min | 1 j | `sub`, `role`, `aud: admin`, MFA obligatoire |

- Refresh tokens **rotatifs**, stockés hachés, révocation en cascade sur réutilisation
  détectée (signal de vol de token).
- Mots de passe : Argon2id.
- Le super admin exige un second facteur, sans exception.

### Contrôle d'accès

`RolesGuard` sur la route, puis vérification métier dans le service quand la règle dépend
de la donnée (« un vendeur ne rembourse que ses propres commandes » est déjà couvert par
l'isolation tenant, mais « un `tenant_staff` ne rembourse pas au-delà de X » ne l'est pas).

### Rate limiting

| Endpoint | Limite |
|---|---|
| `POST /auth/login` | 5 / 15 min / IP + compte |
| `POST /auth/register` | 3 / h / IP |
| `POST /payments/*` | 10 / min / tenant |
| `POST /discounts/validate` | 20 / min / session |
| API générale | 300 / min / tenant |

Compteurs dans Redis, clé préfixée par tenant.

### En-têtes et transport

`helmet`, HSTS, CORS en liste blanche (les domaines personnalisés des tenants sont chargés
dynamiquement depuis la base, avec cache Redis), TLS obligatoire.

## 6. Paiement

### Interface commune à tous les prestataires

```ts
// modules/payments/providers/payment-provider.interface.ts
export interface PaymentProvider {
  readonly code: 'stripe' | 'mtn_momo' | 'orange_money' | 'bank_transfer'

  initiate(input: InitiatePaymentInput): Promise<PaymentIntent>
  /** Doit lever si la signature est invalide. Aucune tolérance. */
  verifyWebhook(raw: Buffer, headers: Record<string, string>): WebhookEvent
  refund(paymentId: string, amount: Money): Promise<RefundResult>
}
```

Aucun module métier ne connaît Stripe ou MTN : il demande un provider au `PaymentRegistry`
selon la devise, le pays et le plan. C'est la mitigation du risque « dépendance à un seul
prestataire » (§17 du cahier des charges).

### Règles absolues

1. **Aucune donnée de carte ne transite par notre API.** Tokenisation côté client.
2. **Toute signature de webhook est vérifiée** avant tout traitement. Un webhook non signé
   est rejeté en 401 et journalisé comme incident de sécurité.
3. **Idempotence obligatoire** — table `webhook_events(provider, external_id)` en clé unique :

```ts
async handleWebhook(provider: string, event: WebhookEvent) {
  const inserted = await this.repo.tryInsertEvent(provider, event.id)
  if (!inserted) return { status: 'duplicate' }   // déjà traité, on sort
  await this.process(event)
}
```

4. **La commande n'est jamais marquée payée depuis la réponse du client.** Seul le webhook
   fait foi. Le client déclenche au mieux un rafraîchissement optimiste.
5. Mobile Money est **asynchrone par nature** : l'utilisateur valide sur son téléphone. L'UI
   doit gérer un état `awaiting_confirmation` avec polling ou WebSocket, et un délai
   d'expiration explicite.
6. Toute transition d'état de paiement écrit une ligne dans `payment_events` (journal
   append-only). On doit pouvoir reconstituer l'historique complet d'un paiement contesté.

## 7. Jobs asynchrones (BullMQ)

Va en job tout ce qui est lent, faillible ou non bloquant pour la réponse HTTP :

| File | Contenu |
|---|---|
| `emails` | Confirmations, factures, relances |
| `search-index` | Réindexation Meilisearch après modification produit |
| `invoicing` | Génération PDF |
| `subscriptions` | Renouvellements, relances d'impayés, suspensions |
| `webhooks-out` | Notifications sortantes vers les tenants |
| `analytics` | Agrégations nocturnes |

Chaque job :
- transporte le `tenantId` dans ses données et **restaure le TenantContext** au démarrage
  (l'AsyncLocalStorage de la requête HTTP n'existe plus dans le worker) ;
- est idempotent (il peut être rejoué) ;
- a un nombre de tentatives et un backoff exponentiel explicites ;
- envoie en *dead letter queue* après échec définitif, avec alerte.

## 8. Temps réel

```ts
@WebSocketGateway({ namespace: '/realtime' })
export class EventsGateway {
  async handleConnection(client: Socket) {
    const payload = await this.auth.verifySocketToken(client.handshake.auth.token)
    // Une room par tenant. Jamais de broadcast global.
    client.join(`tenant:${payload.tid}`)
    if (payload.aud === 'customer') client.join(`customer:${payload.sub}`)
  }
}
```

Événements émis : `order.status_changed`, `inventory.low_stock`, `payment.settled`,
`subscription.past_due`. Le WebSocket est un **accélérateur**, jamais l'unique canal :
l'état reste récupérable par l'API REST si la connexion est tombée.

## 9. Observabilité

- **Logs** structurés JSON (pino), avec `traceId`, `tenantId`, `userId` sur chaque ligne.
  Champs sensibles rédigés par une liste testée.
- **Traces** OpenTelemetry, propagation du `traceId` depuis l'en-tête client.
- **Métriques** : latence p50/p95/p99 par route, taux d'erreur, profondeur des files BullMQ,
  taux de succès des paiements par provider, requêtes SQL par requête HTTP.
- **Alertes** : taux d'erreur 5xx > 1 % sur 5 min, file BullMQ > 1000, échec de paiement
  > 10 % sur 15 min, toute erreur `FORBIDDEN` déclenchée par `getTenantIdOrThrow`
  (symptôme d'un bug d'isolation).

## 10. Checklist — nouvel endpoint

- [ ] DTO d'entrée et de sortie dérivés d'un schéma de `@shopnest/contracts`
- [ ] `ZodValidationPipe` sur toutes les entrées
- [ ] `@Roles` explicite (ou `@Public` explicite — jamais implicite)
- [ ] Modèle scopé présent dans `TENANT_SCOPED_MODELS`
- [ ] Quota de plan vérifié si l'endpoint crée une ressource limitée
- [ ] Test d'isolation : le tenant A ne voit pas la ressource du tenant B
- [ ] Pagination sur toute liste (curseur, jamais `offset` sur les grandes tables)
- [ ] Audit si l'action est sensible
- [ ] Rate limit si l'endpoint est coûteux ou exposé publiquement
- [ ] Documentation OpenAPI générée à jour
