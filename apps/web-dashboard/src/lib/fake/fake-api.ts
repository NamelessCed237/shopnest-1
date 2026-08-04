import type {
  AppError,
  BulkProductActionInput,
  BulkProductResult,
  CreateProductInput,
  CreateVariantInput,
  CursorPage,
  ListProductsQuery,
  LoginInput,
  LoginResponse,
  Product,
  RefreshInput,
  UpdateProductInput,
  UpdateVariantInput,
} from '@shopnest/contracts'
import { PLAN_LIMITS, derivePrice, deriveStock } from '@shopnest/contracts'
import { normalizeForSearch } from '@shopnest/utils'
import { fakeAccounts, fakeCategories, fakeProducts, fakeTenant } from './fixtures'

/**
 * Implémentation factice de l'API — développement sans backend ni base.
 *
 * Elle respecte les MÊMES contrats que le vrai client (`@shopnest/contracts`) :
 * mêmes types de retour, mêmes AppError, même latence perceptible. C'est ce qui
 * garantit que les écrans écrits contre elle fonctionneront tels quels une fois
 * la base disponible — une fausse API trop complaisante ne prouverait rien.
 */

const LATENCY_MS = 400

/** Le rejeu du quota serveur (5 tentatives / 15 min) est simulé, pas ignoré. */
const MAX_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 15 * 60_000
const attempts = new Map<string, number[]>()

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const traceId = () => crypto.randomUUID()

function fail(
  code: AppError['code'],
  userMessageKey: string,
  fields?: Record<string, string>,
): never {
  const error: AppError = {
    code,
    message: `[fake-api] ${code}`,
    userMessageKey,
    ...(fields ? { fields } : {}),
    traceId: traceId(),
  }
  throw error
}

function checkRateLimit(email: string): void {
  const now = Date.now()
  const recent = (attempts.get(email) ?? []).filter((t) => now - t < ATTEMPT_WINDOW_MS)
  if (recent.length >= MAX_ATTEMPTS) fail('RATE_LIMITED', 'errors.rateLimited')
  attempts.set(email, [...recent, now])
}

/** Sessions en mémoire : un rechargement de page les perd, comme un vrai redémarrage serveur. */
const sessions = new Map<string, LoginResponse['user']>()

function issue(user: LoginResponse['user']): LoginResponse {
  const refreshToken = crypto.randomUUID()
  sessions.set(refreshToken, user)
  return {
    accessToken: `fake.${btoa(JSON.stringify({ sub: user.id, aud: user.audience }))}.token`,
    refreshToken,
    expiresIn: 15 * 60,
    user,
  }
}

export const fakeAuthEndpoints = {
  async loginTenantUser(input: LoginInput): Promise<LoginResponse> {
    await sleep(LATENCY_MS)
    checkRateLimit(input.email)

    const account = fakeAccounts.find((a) => a.user.email === input.email.toLowerCase())

    // Message identique que l'email soit inconnu ou le mot de passe faux —
    // même règle que le vrai backend (doc/03 §5), sinon l'écran se comporterait
    // différemment une fois branché.
    if (!account || account.password !== input.password) {
      fail('UNAUTHENTICATED', 'errors.auth.invalidCredentials')
    }

    attempts.delete(input.email)
    return issue(account.user)
  },

  async refresh(input: RefreshInput): Promise<LoginResponse> {
    await sleep(LATENCY_MS / 2)
    const user = sessions.get(input.refreshToken)
    if (!user) fail('UNAUTHENTICATED', 'errors.unauthenticated')

    // Rotation : le token présenté est consommé, comme côté serveur.
    sessions.delete(input.refreshToken)
    return issue(user)
  },

  async logout(input: RefreshInput): Promise<void> {
    await sleep(LATENCY_MS / 2)
    sessions.delete(input.refreshToken)
  },
}

/**
 * Le filtrage, le tri et la pagination sont faits ICI, comme le ferait la base.
 * Renvoyer la liste entière et laisser l'écran filtrer masquerait exactement les
 * défauts qu'on veut voir en développement (doc/02 §2).
 */
export const fakeProductEndpoints = {
  async list(query: Partial<ListProductsQuery>): Promise<CursorPage<Product>> {
    await sleep(LATENCY_MS)

    // Insensible aux accents, comme le fera `unaccent` côté PostgreSQL :
    // « ecran » doit trouver « Écran » (doc/03 §4).
    const search = query.search ? normalizeForSearch(query.search) : undefined
    let items = fakeProducts.filter((product) => {
      if (query.status && product.status !== query.status) return false
      if (query.categoryId && !product.categoryIds.includes(query.categoryId)) return false
      if (search && !normalizeForSearch(product.name).includes(search)) return false
      return true
    })

    const sortBy = query.sortBy ?? 'createdAt'
    const direction = query.sortOrder === 'asc' ? 1 : -1
    items = [...items].sort((a, b) => direction * compareBy(sortBy, a, b))

    const limit = query.limit ?? 20
    const start = query.cursor ? items.findIndex((p) => p.id === query.cursor) + 1 : 0
    const page = items.slice(start, start + limit)
    const nextCursor = start + limit < items.length ? page.at(-1)?.id : undefined

    return {
      items: page,
      ...(nextCursor ? { nextCursor } : {}),
      total: items.length,
    }
  },
}

// --- CRUD produits ------------------------------------------------------------

/** Copie défensive : voir `snapshot` dans fake-orders-api (React Query). */
const snapshotProduct = (product: Product): Product => ({
  ...product,
  price: { ...product.price },
  imageUrls: [...product.imageUrls],
  categoryIds: [...product.categoryIds],
  variants: product.variants.map((variant) => ({ ...variant })),
})

function productError(
  code: AppError['code'],
  userMessageKey: string,
  message: string,
  fields?: Record<string, string>,
): AppError {
  return {
    code,
    message: `[fake-api] ${message}`,
    userMessageKey,
    ...(fields ? { fields } : {}),
    traceId: crypto.randomUUID(),
  }
}

function assertSlugAvailable(slug: string, exceptId?: string): void {
  const clash = fakeProducts.find((p) => p.slug === slug && p.id !== exceptId)
  if (!clash) return
  // Erreur PAR CHAMP : le formulaire la replace sous le bon champ plutôt que
  // d'afficher un bandeau générique en haut de page (doc/02 §5).
  throw productError('CONFLICT', 'errors.product.slugTaken', `slug ${slug} déjà pris`, {
    slug: 'errors.product.slugTaken',
  })
}

export const fakeProductMutations = {
  async detail(productId: string, _options?: { signal?: AbortSignal }): Promise<Product> {
    await sleep(LATENCY_MS / 2)
    const product = fakeProducts.find((item) => item.id === productId)
    if (!product) {
      throw productError('NOT_FOUND', 'errors.notFound', `product ${productId} not found`)
    }
    return snapshotProduct(product)
  },

  async create(input: CreateProductInput): Promise<Product> {
    await sleep(LATENCY_MS)

    /*
     * Quota du plan vérifié CÔTÉ SERVEUR, pas seulement en masquant le bouton.
     * Le guard backend (PlanLimitGuard) applique la même règle depuis la même
     * source : PLAN_LIMITS (doc/02 §1.2).
     */
    const limit = PLAN_LIMITS[fakeTenant.planCode].maxProducts
    const active = fakeProducts.filter((p) => p.status !== 'archived').length
    if (active >= limit) {
      throw productError(
        'PLAN_LIMIT_REACHED',
        'errors.planLimitReached',
        `quota atteint : ${active}/${limit}`,
      )
    }

    assertSlugAvailable(input.slug)

    const now = new Date().toISOString()
    const product: Product = {
      ...input,
      id: crypto.randomUUID(),
      variants: [],
      createdAt: now,
      updatedAt: now,
    }

    // En tête de liste : le produit qu'on vient de créer doit être visible
    // immédiatement, sans avoir à changer le tri.
    fakeProducts.unshift(product)
    return snapshotProduct(product)
  },

  async update(productId: string, input: UpdateProductInput): Promise<Product> {
    await sleep(LATENCY_MS)

    const index = fakeProducts.findIndex((item) => item.id === productId)
    if (index === -1) {
      throw productError('NOT_FOUND', 'errors.notFound', `product ${productId} not found`)
    }

    if (input.slug) assertSlugAvailable(input.slug, productId)

    const current = fakeProducts[index]!
    const merged: Product = { ...current, ...input, updatedAt: new Date().toISOString() }

    /*
     * Défense en profondeur : dès qu'une variante existe, le stock et le prix
     * du produit sont RECALCULÉS et non repris du corps de requête.
     *
     * L'interface grise déjà ces champs, mais un client obsolète — ou un
     * formulaire ouvert avant l'ajout d'une variante — enverrait l'ancienne
     * valeur et corromprait le stock en silence. C'est la donnée dont l'erreur
     * coûte le plus cher : on vend ce qu'on n'a plus.
     */
    const updated: Product =
      merged.variants.length > 0
        ? {
            ...merged,
            stock: deriveStock(merged.variants, merged.stock),
            price: derivePrice(merged.variants, merged.price),
          }
        : merged

    fakeProducts[index] = updated
    return snapshotProduct(updated)
  },

  /**
   * Archivage et NON suppression.
   *
   * doc/03 §4 — un produit référencé par une commande ne se supprime pas :
   * l'historique d'achat deviendrait illisible. L'archivage le retire du
   * catalogue tout en préservant les commandes passées.
   */
  async archive(productId: string): Promise<Product> {
    await sleep(LATENCY_MS)

    const index = fakeProducts.findIndex((item) => item.id === productId)
    if (index === -1) {
      throw productError('NOT_FOUND', 'errors.notFound', `product ${productId} not found`)
    }

    const archived: Product = {
      ...fakeProducts[index]!,
      status: 'archived',
      updatedAt: new Date().toISOString(),
    }
    fakeProducts[index] = archived
    return snapshotProduct(archived)
  },

  /**
   * Actions groupées.
   *
   * Comme le backend, on renvoie le nombre de produits RÉELLEMENT modifiés :
   * un identifiant inconnu est ignoré en silence plutôt que de faire échouer
   * tout le lot. L'écran doit se comporter pareil dans les deux modes.
   */
  async bulk(input: BulkProductActionInput): Promise<BulkProductResult> {
    await sleep(LATENCY_MS)

    let affected = 0
    for (const id of input.ids) {
      const index = fakeProducts.findIndex((item) => item.id === id)
      if (index === -1) continue

      const current = fakeProducts[index]!
      const updatedAt = new Date().toISOString()

      if (input.action === 'archive') {
        fakeProducts[index] = { ...current, status: 'archived', updatedAt }
      } else if (input.action === 'setStatus') {
        fakeProducts[index] = { ...current, status: input.status, updatedAt }
      } else {
        const withoutIt = current.categoryIds.filter((c) => c !== input.categoryId)
        fakeProducts[index] = {
          ...current,
          categoryIds:
            input.action === 'addCategory' ? [...withoutIt, input.categoryId] : withoutIt,
          updatedAt,
        }
      }
      affected += 1
    }

    return { affected }
  },
}

// --- Variantes ----------------------------------------------------------------

/**
 * Un SKU est unique à l'échelle du TENANT, pas du produit : on cherche donc la
 * collision dans tout le catalogue, pas seulement parmi les variantes sœurs.
 */
function assertSkuAvailable(sku: string, exceptVariantId?: string): void {
  const clash = fakeProducts.some((product) =>
    product.variants.some((variant) => variant.sku === sku && variant.id !== exceptVariantId),
  )
  if (!clash) return
  throw productError('CONFLICT', 'errors.variant.skuTaken', `sku ${sku} déjà pris`, {
    sku: 'errors.variant.skuTaken',
  })
}

/**
 * Réapplique les valeurs dérivées après toute modification de variantes.
 *
 * Sans ce recalcul, le produit conserverait le stock saisi avant l'ajout des
 * variantes : la liste afficherait « 12 en stock » pour un produit dont les
 * variantes totalisent 0, et on vendrait un article épuisé.
 */
function reindexDerivedFields(product: Product): Product {
  return {
    ...product,
    stock: deriveStock(product.variants, product.stock),
    price: derivePrice(product.variants, product.price),
    updatedAt: new Date().toISOString(),
  }
}

function mutableProduct(productId: string): { product: Product; index: number } {
  const index = fakeProducts.findIndex((item) => item.id === productId)
  if (index === -1) {
    throw productError('NOT_FOUND', 'errors.notFound', `product ${productId} not found`)
  }
  return { product: fakeProducts[index]!, index }
}

export const fakeVariantMutations = {
  async addVariant(productId: string, input: CreateVariantInput): Promise<Product> {
    await sleep(LATENCY_MS)

    const { product, index } = mutableProduct(productId)
    assertSkuAvailable(input.sku)

    const updated = reindexDerivedFields({
      ...product,
      variants: [...product.variants, { ...input, id: crypto.randomUUID() }],
    })
    fakeProducts[index] = updated
    return snapshotProduct(updated)
  },

  async updateVariant(
    productId: string,
    variantId: string,
    input: UpdateVariantInput,
  ): Promise<Product> {
    await sleep(LATENCY_MS)

    const { product, index } = mutableProduct(productId)
    const variantIndex = product.variants.findIndex((v) => v.id === variantId)
    if (variantIndex === -1) {
      throw productError('NOT_FOUND', 'errors.notFound', `variant ${variantId} not found`)
    }

    if (input.sku) assertSkuAvailable(input.sku, variantId)

    const variants = [...product.variants]
    variants[variantIndex] = { ...variants[variantIndex]!, ...input }

    const updated = reindexDerivedFields({ ...product, variants })
    fakeProducts[index] = updated
    return snapshotProduct(updated)
  },

  async removeVariant(productId: string, variantId: string): Promise<Product> {
    await sleep(LATENCY_MS)

    const { product, index } = mutableProduct(productId)
    if (!product.variants.some((v) => v.id === variantId)) {
      throw productError('NOT_FOUND', 'errors.notFound', `variant ${variantId} not found`)
    }

    /*
     * En retirant la DERNIÈRE variante, le produit repasse en stock et prix
     * propres. On conserve les valeurs de la variante supprimée plutôt que de
     * remettre zéro : le vendeur retrouve un produit vendable, pas un produit
     * fantôme à 0 F qu'il devra corriger sans y penser.
     */
    const remaining = product.variants.filter((v) => v.id !== variantId)
    const removed = product.variants.find((v) => v.id === variantId)!

    const base: Product =
      remaining.length === 0
        ? { ...product, variants: [], stock: removed.stock, price: removed.price }
        : { ...product, variants: remaining }

    const updated = reindexDerivedFields(base)
    fakeProducts[index] = updated
    return snapshotProduct(updated)
  },
}

function compareBy(key: NonNullable<ListProductsQuery['sortBy']>, a: Product, b: Product): number {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name, 'fr')
    case 'price':
      return a.price.amountCents - b.price.amountCents
    case 'stock':
      return a.stock - b.stock
    case 'createdAt':
      return a.createdAt.localeCompare(b.createdAt)
  }
}

export const fakeCategoryEndpoints = {
  async listOptions(search: string) {
    await sleep(LATENCY_MS / 2)
    const needle = normalizeForSearch(search)
    const items = needle
      ? fakeCategories.filter((c) => normalizeForSearch(c.name).includes(needle))
      : fakeCategories
    return { options: items.map((c) => ({ value: c.id, label: c.name, raw: c })) }
  },
}
