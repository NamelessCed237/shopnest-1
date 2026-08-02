export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Exhaustivité des unions discriminées — doc/02 §4.
 * Ajouter un cas à une union sans le traiter devient une erreur de compilation.
 */
export function assertNever(value: never, context = 'unhandled case'): never {
  throw new Error(`${context}: ${JSON.stringify(value)}`)
}

export function safeJsonParse<T = unknown>(input: string): T | undefined {
  try {
    return JSON.parse(input) as T
  } catch {
    return undefined
  }
}
