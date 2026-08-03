import { useTranslation } from '@shopnest/i18n/react'
import { LanguageSwitcher, ThemeToggle, type LanguageOption } from '@shopnest/ui-web'

/**
 * Réglages d'affichage : langue et thème.
 *
 * Regroupés dans un seul composant parce qu'ils partagent la même nature —
 * des préférences personnelles, pas des données métier — et qu'ils doivent
 * apparaître au même endroit dans les trois applications.
 */
const LANGUAGES: readonly LanguageOption[] = [
  { value: 'fr', label: 'Français', shortLabel: 'FR' },
  { value: 'en', label: 'English', shortLabel: 'EN' },
]

export function PreferencesControls() {
  const { t, locale, setLocale } = useTranslation()

  return (
    <div className="flex items-center gap-sm">
      <LanguageSwitcher
        value={locale}
        options={LANGUAGES}
        onChange={(value) => setLocale(value as 'fr' | 'en')}
        groupLabel={t('preferences.language')}
      />

      <ThemeToggle
        groupLabel={t('preferences.theme')}
        labels={{
          system: t('preferences.theme.system'),
          light: t('preferences.theme.light'),
          dark: t('preferences.theme.dark'),
        }}
      />
    </div>
  )
}
