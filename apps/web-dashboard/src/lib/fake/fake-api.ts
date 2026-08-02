import type {
  AppError,
  CursorPage,
  LoginInput,
  LoginResponse,
  Product,
  RefreshInput,
} from '@shopnest/contracts'
import { fakeAccounts, fakeProducts } from './fixtures'

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

export const fakeProductEndpoints = {
  async list(query: { search?: string; limit?: number }): Promise<CursorPage<Product>> {
    await sleep(LATENCY_MS)
    const search = query.search?.trim().toLowerCase()
    const items = search
      ? fakeProducts.filter((p) => p.name.toLowerCase().includes(search))
      : fakeProducts
    return { items: items.slice(0, query.limit ?? 20), total: items.length }
  },
}
