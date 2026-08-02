import { AppErrorSchema, type AppError } from '@shopnest/contracts'

/**
 * doc/06 §3 — client HTTP plateforme-agnostique.
 *
 * Il ne connaît ni `window`, ni `AsyncStorage`, ni la navigation : tout ce qui est
 * spécifique à une plateforme est injecté. C'est ce qui le rend partageable entre
 * les 3 apps web, le mobile et le desktop.
 */

export interface TokenStorage {
  getAccessToken(): Promise<string | undefined> | string | undefined
  getRefreshToken(): Promise<string | undefined> | string | undefined
  setTokens(tokens: { accessToken: string; refreshToken: string }): Promise<void> | void
  clear(): Promise<void> | void
}

export interface ApiClientConfig {
  baseUrl: string
  tokenStorage: TokenStorage
  /** Sous-domaine (web) ou sélection explicite (mobile). */
  getTenantId: () => string | undefined
  onUnauthenticated: () => void
  /** Locale envoyée à l'API pour la résolution des clés i18n côté serveur. */
  getLocale?: () => string
}

export interface RequestOptions {
  signal?: AbortSignal
  /** Rejouable sans effet de bord — doc/03 §6. */
  idempotencyKey?: string
  skipAuth?: boolean
}

export class ApiClient {
  /** Une seule requête de refresh, même si dix appels échouent simultanément. */
  private refreshPromise: Promise<boolean> | undefined

  constructor(private readonly config: ApiClientConfig) {}

  get<T>(path: string, query?: Record<string, unknown>, options?: RequestOptions) {
    return this.request<T>('GET', buildUrl(path, query), undefined, options)
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('POST', path, body, options)
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('PATCH', path, body, options)
  }

  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>('DELETE', path, undefined, options)
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await this.send(method, path, body, options)

    if (response.status === 401 && !options.skipAuth) {
      const refreshed = await this.refreshOnce()
      if (!refreshed) {
        this.config.onUnauthenticated()
        throw await toAppError(response)
      }
      const retried = await this.send(method, path, body, options)
      if (!retried.ok) throw await toAppError(retried)
      return parseBody<T>(retried)
    }

    if (!response.ok) throw await toAppError(response)
    return parseBody<T>(response)
  }

  private async send(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept-Language': this.config.getLocale?.() ?? 'fr',
    }

    const tenantId = this.config.getTenantId()
    if (tenantId) headers['X-Tenant-Id'] = tenantId

    if (!options.skipAuth) {
      const token = await this.config.tokenStorage.getAccessToken()
      if (token) headers.Authorization = `Bearer ${token}`
    }

    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey

    return fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(options.signal ? { signal: options.signal } : {}),
    })
  }

  private refreshOnce(): Promise<boolean> {
    this.refreshPromise ??= this.doRefresh().finally(() => {
      this.refreshPromise = undefined
    })
    return this.refreshPromise
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken = await this.config.tokenStorage.getRefreshToken()
    if (!refreshToken) return false

    const response = await fetch(`${this.config.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      await this.config.tokenStorage.clear()
      return false
    }

    const tokens = (await response.json()) as { accessToken: string; refreshToken: string }
    await this.config.tokenStorage.setTokens(tokens)
    return true
  }
}

export const createApiClient = (config: ApiClientConfig) => new ApiClient(config)

/**
 * Encodage manuel plutôt que `URLSearchParams` : ce package doit compiler à
 * l'identique sous React Native, dont les types URLSearchParams sont incomplets
 * (doc/06 §3 — plateforme-agnostique).
 */
function buildUrl(path: string, query?: Record<string, unknown>): string {
  if (!query) return path
  const parts: string[] = []
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return parts.length > 0 ? `${path}?${parts.join('&')}` : path
}

async function parseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** doc/02 §5 — toute erreur devient un AppError, format unique côté clients. */
async function toAppError(response: Response): Promise<AppError> {
  try {
    const parsed = AppErrorSchema.safeParse(await response.json())
    if (parsed.success) return parsed.data
  } catch {
    // corps non-JSON : on retombe sur l'erreur générique ci-dessous
  }
  return {
    code: response.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL',
    message: `HTTP ${response.status}`,
    userMessageKey: 'errors.generic',
    traceId: response.headers.get('x-trace-id') ?? 'unknown',
  }
}
