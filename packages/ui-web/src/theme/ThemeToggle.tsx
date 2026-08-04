import { THEME_PREFERENCES, useTheme, type ThemePreference } from './ThemeProvider.js'
import { cn } from '../lib/cn.js'
import { Icon, type IconName } from '../icon/Icon.js'

const ICON: Record<ThemePreference, IconName> = {
  system: 'monitor',
  light: 'sun',
  dark: 'moon',
}

export interface ThemeToggleProps {
  labels: Record<ThemePreference, string>
  groupLabel: string
}

/**
 * Trois états et non deux : « système » est un choix légitime, et le retirer
 * force l'utilisateur à re-choisir manuellement à chaque bascule de son OS.
 *
 * Les libellés sont passés en props : `ui-web` ne dépend pas de `i18n` pour
 * rester utilisable dans Storybook et dans des contextes sans traduction.
 */
export function ThemeToggle({ labels, groupLabel }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme()

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="inline-flex rounded-md border border-border-base p-[2px]"
    >
      {THEME_PREFERENCES.map((option) => {
        const active = preference === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => setPreference(option)}
            aria-pressed={active}
            title={labels[option]}
            className={cn(
              'grid h-7 w-8 place-items-center rounded-sm text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              active
                ? 'bg-brand-primarySubtle text-brand-primary'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <Icon name={ICON[option]} />
            <span className="sr-only">{labels[option]}</span>
          </button>
        )
      })}
    </div>
  )
}
