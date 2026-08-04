import { cn } from '../lib/cn.js'

export interface LanguageOption<T extends string = string> {
  value: T
  /** Nom de la langue DANS cette langue — « Français », pas « French ». */
  label: string
  shortLabel: string
}

/**
 * Générique sur le code de langue : avec `T = 'fr' | 'en'`, `onChange` rend
 * directement une locale valide. En `string`, l'appelant devait la re-caster —
 * un cast qui aurait survécu à l'ajout d'une troisième langue sans rien signaler.
 */
export interface LanguageSwitcherProps<T extends string = string> {
  value: T
  options: readonly LanguageOption<T>[]
  onChange: (value: T) => void
  groupLabel: string
}

/**
 * Boutons plutôt qu'une liste déroulante : avec deux ou trois langues, un
 * déroulant demande deux interactions pour ce qui en vaut une.
 *
 * Chaque langue est écrite dans sa propre langue : un utilisateur perdu dans
 * une interface qu'il ne lit pas doit pouvoir reconnaître la sienne.
 */
export function LanguageSwitcher<T extends string = string>({
  value,
  options,
  onChange,
  groupLabel,
}: LanguageSwitcherProps<T>) {
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="inline-flex rounded-md border border-border-base p-[2px]"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            // `lang` sur le bouton : le lecteur d'écran prononce « Français »
            // avec l'accent français même dans une page anglaise.
            lang={option.value}
            title={option.label}
            className={cn(
              'rounded-sm px-sm py-[2px] text-xs font-medium uppercase outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              active
                ? 'bg-brand-primarySubtle text-brand-primary'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <span aria-hidden="true">{option.shortLabel}</span>
            <span className="sr-only">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
