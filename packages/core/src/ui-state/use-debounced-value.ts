import { useEffect, useState } from 'react'

/**
 * doc/02 §2.3 — sans debounce, taper « ordinateur » déclenche 11 requêtes dont
 * 10 sont obsolètes avant d'arriver. `useAsyncOptions` en a un intégré ; tout
 * autre champ de recherche doit passer par ce hook.
 *
 * Headless : utilisé à l'identique par le web et le mobile.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
