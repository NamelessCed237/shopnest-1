import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { THEME_MODES, type ThemeMode } from '@shopnest/tokens'

/** `system` n'est pas un thème : c'est l'absence de choix explicite. */
export type ThemePreference = ThemeMode | 'system'

const STORAGE_KEY = 'shopnest.theme'

interface ThemeValue {
  preference: ThemePreference
  /** Le thème RÉELLEMENT appliqué, une fois `system` résolu. */
  resolved: ThemeMode
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeValue | undefined>(undefined)

function readStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function systemMode(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [system, setSystem] = useState<ThemeMode>(systemMode)

  // La préférence système peut changer pendant la session (bascule automatique
  // au coucher du soleil sur macOS et Windows) : on l'écoute au lieu de la lire
  // une seule fois au démarrage.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystem(media.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved: ThemeMode = preference === 'system' ? system : preference

  useEffect(() => {
    const root = document.documentElement
    // `system` retire l'attribut : la règle @media du CSS reprend la main, ce
    // qui évite de figer un thème si l'utilisateur change d'avis côté OS.
    if (preference === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', preference)
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, next)
    setPreferenceState(next)
  }, [])

  const value = useMemo<ThemeValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme doit être utilisé dans un <ThemeProvider>')
  return value
}

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', ...THEME_MODES]

/**
 * Script à injecter dans le <head> AVANT le rendu.
 *
 * Sans lui, la page s'affiche en clair puis bascule en sombre au premier rendu
 * React : un flash blanc en pleine nuit, sur chaque chargement.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}');if(p==='light'||p==='dark'){document.documentElement.setAttribute('data-theme',p)}}catch(e){}})()`
