type ClassValue = string | false | null | undefined | Record<string, boolean | undefined>

export function cn(...values: ClassValue[]): string {
  const out: string[] = []
  for (const value of values) {
    if (!value) continue
    if (typeof value === 'string') {
      out.push(value)
      continue
    }
    for (const [key, enabled] of Object.entries(value)) if (enabled) out.push(key)
  }
  return out.join(' ')
}
