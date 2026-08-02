export interface RetryOptions {
  attempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  /** Ne retente pas les erreurs définitives (4xx métier). */
  shouldRetry?: (error: unknown) => boolean
}

/** Backoff exponentiel — utilisé par les jobs BullMQ et les appels prestataires. */
export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { attempts = 3, baseDelayMs = 200, maxDelayMs = 5_000, shouldRetry = () => true } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error
      if (attempt === attempts || !shouldRetry(error)) break
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)
      await sleep(delay)
    }
  }
  throw lastError
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Exécute des tâches en parallèle avec une concurrence BORNÉE.
 * `Promise.all` sur 10 000 items ouvre 10 000 connexions simultanées — doc/02 §2.5.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index] as T, index)
    }
  })

  await Promise.all(workers)
  return results
}
