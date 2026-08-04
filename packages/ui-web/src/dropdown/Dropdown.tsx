import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import * as Popover from '@radix-ui/react-popover'
import {
  useSelect,
  type Option,
  type OptionSource,
  type UseSelectParams,
} from '@shopnest/core'
import { Field } from '../field/Field.js'
import { Icon } from '../icon/Icon.js'
import { OptionSkeleton } from '../feedback/OptionSkeleton.js'
import { ErrorState } from '../feedback/ErrorState.js'
import { EmptyState } from '../feedback/EmptyState.js'
import { cn } from '../lib/cn.js'

/**
 * doc/07 §3.4 — cas de référence du contrat de composants.
 *
 * Le composant NE FAIT QUE DU RENDU : debounce, annulation, pagination, dépendances,
 * clavier et accessibilité viennent de useSelect (@shopnest/core), partagé avec le mobile.
 * C'est pour cela qu'il est court.
 */

/** Tout ce qui ne dépend pas du mode de sélection. */
interface DropdownCommonProps<T> {
  /** R1 — une SOURCE, pas des données. Statique | fonction | query | entity. */
  source: OptionSource<T>

  clearable?: boolean
  searchable?: boolean
  creatable?: boolean
  onCreate?: (label: string) => Promise<Option<T>>
  /** Dépendances : pays → ville. Un changement vide et recharge la liste. */
  deps?: Record<string, unknown>
  /** Requis uniquement pour une source `{ entity: … }` — fourni par l'app (doc/06 §3). */
  entityResolver?: UseSelectParams<T>['entityResolver']

  label?: string
  placeholder?: string
  helperText?: string
  error?: string
  disabled?: boolean
  required?: boolean

  // R8 — variantes typées, jamais de className injecté de l'extérieur
  variant?: 'outline' | 'ghost' | 'filled'
  size?: 'sm' | 'md' | 'lg'

  // R6 — rendu substituable
  renderOption?: (
    option: Option<T>,
    state: { selected: boolean; highlighted: boolean },
  ) => ReactNode
  renderTrigger?: (state: { selected: Option<T>[]; isOpen: boolean }) => ReactNode
  renderEmpty?: () => ReactNode

  /** Libellés — `ui-web` ne dépend pas de `@shopnest/i18n` (doc/06 §1). */
  labels?: Partial<DropdownLabels>
}

export interface DropdownLabels {
  selectedCount: (count: number) => string
  selectAll: string
  clearAll: string
  remove: (label: string) => string
  create: (search: string) => string
}

const DEFAULT_LABELS: DropdownLabels = {
  selectedCount: (count) => `${count} sélectionnés`,
  selectAll: 'Tout sélectionner',
  clearAll: 'Tout effacer',
  remove: (label) => `Retirer ${label}`,
  create: (search) => `Créer « ${search} »`,
}

/**
 * R4 — contrôlé ou non contrôlé, et TYPÉ SELON LE MODE.
 *
 * `multiple` discrimine l'union : ajouter ce seul mot retype `value` et
 * `onChange`, et le compilateur pointe ce qui reste à ajuster. Avant, la
 * signature commune `T | T[]` imposait un cast à chaque appelant, et passer un
 * champ en multiple se faisait à la main de proche en proche.
 */
export type DropdownProps<T = string> =
  | (DropdownCommonProps<T> & {
      multiple?: false
      value?: T
      defaultValue?: T
      onChange?: (value: T | undefined, option: Option<T> | undefined) => void
    })
  | (DropdownCommonProps<T> & {
      multiple: true
      value?: T[]
      defaultValue?: T[]
      onChange?: (value: T[], options: Option<T>[]) => void
    })

/**
 * `Omit` qui SURVIT à une union.
 *
 * `Omit<A | B, 'x'>` ne retire pas `x` de A et de B : il fusionne d'abord les
 * deux en un objet unique, puis retire. Le résultat perd la discrimination, et
 * un wrapper métier écrit avec `Omit<DropdownProps, 'source'>` n'accepterait
 * plus ni la variante simple ni la variante multiple.
 *
 * `T extends unknown` force la distribution sur chaque membre.
 */
export type DistributiveOmit<T, K extends keyof never> = T extends unknown
  ? Omit<T, K>
  : never

/** À utiliser pour tout wrapper métier autour de `Dropdown` (doc/07 §3.7). */
export type DropdownWrapperProps<T = string, K extends keyof never = never> = DistributiveOmit<
  DropdownProps<T>,
  K
>

export function Dropdown<T = string>(props: DropdownProps<T>) {
  const {
    label,
    placeholder = 'Sélectionner…',
    helperText,
    error,
    required,
    variant = 'outline',
    size = 'md',
    renderOption,
    renderTrigger,
    renderEmpty,
  } = props

  const labels = { ...DEFAULT_LABELS, ...props.labels }
  const listRef = useRef<HTMLUListElement>(null)
  const { state, actions, a11y, keyboard } = useSelect<T>(props as UseSelectParams<T>)

  const onKeyDown = (event: KeyboardEvent) => {
    if (keyboard.handleKeyDown(event.key)) event.preventDefault()
  }

  return (
    <Field label={label} error={error} helperText={helperText} required={required}>
      <Popover.Root open={state.isOpen} onOpenChange={actions.toggle}>
        <Popover.Trigger asChild>
          <button
            type="button"
            {...a11y.trigger}
            onKeyDown={onKeyDown}
            disabled={state.disabled}
            className={cn(TRIGGER_BASE, TRIGGER_VARIANT[variant], TRIGGER_SIZE[size], {
              'border-status-danger': Boolean(error),
            })}
          >
            {renderTrigger?.({ selected: state.selected, isOpen: state.isOpen }) ?? (
              <TriggerContent
                selected={state.selected}
                placeholder={placeholder}
                multiple={state.multiple}
                labels={labels}
                onRemove={actions.remove}
              />
            )}
            <span
              className={cn('shrink-0 transition-transform', { 'rotate-180': state.isOpen })}
            >
              <Icon name="chevron-down" />
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Content
          className="z-dropdown w-[var(--radix-popover-trigger-width)] rounded-md border border-border-base bg-surface-base shadow-lg"
          sideOffset={4}
        >
          {state.searchable && (
            <SearchInput
              value={state.search}
              onChange={actions.setSearch}
              loading={state.status === 'loading'}
            />
          )}

          {/*
            Bascule « tout » — seulement en multiple, et seulement si TOUTE la
            liste est chargée. Sur une source paginée, elle ne porterait que sur
            la page courante : l'utilisateur croirait avoir tout coché alors
            qu'il en manque, ce qui est pire que de ne rien proposer.
          */}
          {state.multiple && state.status === 'success' && !state.hasNextPage && (
            <button
              type="button"
              onClick={actions.toggleAll}
              className="flex w-full items-center gap-sm border-b border-border-base px-sm py-xs text-left text-sm text-text-secondary hover:text-text-primary"
            >
              <CheckBox checked={state.allSelected} />
              {state.allSelected ? labels.clearAll : labels.selectAll}
            </button>
          )}

          {/* R5 — les quatre états sont rendus par le composant, pas par l'appelant */}
          {state.status === 'loading' && <OptionSkeleton count={5} />}

          {state.status === 'error' && (
            <ErrorState error={state.error} onRetry={actions.retry} />
          )}

          {state.status === 'empty' &&
            (renderEmpty?.() ?? <EmptyState search={state.search} />)}

          {state.status === 'success' && (
            <ul
              ref={listRef}
              {...a11y.listbox}
              className="max-h-72 overflow-y-auto p-xs"
              onScroll={(e) => {
                const el = e.currentTarget
                if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) actions.fetchNextPage()
              }}
            >
              {state.options.map((option, index) => (
                <li
                  key={String(option.value)}
                  {...a11y.option(index)}
                  onClick={() => actions.select(option)}
                  onMouseEnter={() => actions.setHighlightedIndex(index)}
                  className={cn('cursor-pointer rounded-sm px-sm py-xs', {
                    'bg-brand-primarySubtle': state.highlightedIndex === index,
                    'opacity-50': option.disabled,
                  })}
                >
                  {renderOption?.(option, {
                    selected: state.isSelected(option),
                    highlighted: state.highlightedIndex === index,
                  }) ?? (
                    <DefaultOption
                      option={option}
                      selected={state.isSelected(option)}
                      multiple={state.multiple}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}

          {state.isFetchingNextPage && <OptionSkeleton count={2} />}

          {state.canCreate && (
            <button
              type="button"
              onClick={() => void actions.create()}
              className="w-full border-t border-border-base px-sm py-xs text-left text-sm text-brand-primary"
            >
              {labels.create(state.search)}
            </button>
          )}
        </Popover.Content>
      </Popover.Root>
    </Field>
  )
}

// --- Sous-composants privés --------------------------------------------------

/**
 * Contenu du déclencheur.
 *
 * En sélection multiple, des PASTILLES retirables plutôt qu'un « 3
 * sélectionnés » : ce compteur oblige à rouvrir la liste rien que pour savoir
 * ce qui est coché, et à la parcourir pour en retirer un seul.
 *
 * Au-delà de trois, on bascule sur un compteur — sinon le déclencheur s'étire
 * et bouscule la mise en page de la barre de filtres.
 */
function TriggerContent<T>({
  selected,
  placeholder,
  multiple,
  labels,
  onRemove,
}: {
  selected: Option<T>[]
  placeholder: string
  multiple: boolean
  labels: DropdownLabels
  onRemove: (value: T) => void
}) {
  if (selected.length === 0) {
    return <span className="truncate text-text-disabled">{placeholder}</span>
  }

  if (!multiple || selected.length === 1) {
    return <span className="truncate">{selected[0]?.label}</span>
  }

  if (selected.length > 3) {
    return <span className="truncate">{labels.selectedCount(selected.length)}</span>
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-xs">
      {selected.map((option) => (
        <span
          key={String(option.value)}
          className="flex max-w-40 items-center gap-xs rounded-sm bg-brand-primarySubtle px-xs py-[1px] text-xs text-brand-primary"
        >
          <span className="truncate">{option.label}</span>
          {/*
            `<span role="button">` et non `<button>` : ce contenu vit DANS le
            bouton déclencheur, et un bouton imbriqué dans un bouton est du HTML
            invalide que les navigateurs corrigent en le sortant du DOM.
          */}
          <span
            role="button"
            tabIndex={-1}
            aria-label={labels.remove(option.label)}
            onClick={(event) => {
              // Sans cela, le clic remonte au déclencheur et rouvre la liste
              // au moment même où l'on vient d'en retirer un élément.
              event.stopPropagation()
              onRemove(option.value)
            }}
            className="opacity-70 hover:opacity-100"
          >
            <Icon name="close" size="sm" />
          </span>
        </span>
      ))}
    </span>
  )
}

function DefaultOption<T>({
  option,
  selected,
  multiple,
}: {
  option: Option<T>
  selected: boolean
  multiple: boolean
}) {
  return (
    <div className="flex items-center gap-sm">
      {/*
        Case à cocher en multiple, coche à droite en simple.
        La case dit « on peut en prendre plusieurs » AVANT le premier clic ;
        une coche seule ne se distingue pas d'un choix unique déjà fait, et
        l'utilisateur referme le menu croyant avoir terminé.
      */}
      {multiple && <CheckBox checked={selected} />}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-text-primary">{option.label}</div>
        {option.description && (
          <div className="truncate text-xs text-text-secondary">{option.description}</div>
        )}
      </div>

      {!multiple && selected && (
        <span className="text-brand-primary">
          <Icon name="check" />
        </span>
      )}
    </div>
  )
}

/** Case DÉCORATIVE : l'état sélectionné est déjà porté par `aria-selected`. */
function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid h-4 w-4 shrink-0 place-items-center rounded-sm border transition-colors',
        checked
          ? 'border-brand-primary bg-brand-primary text-brand-onPrimary'
          : 'border-border-strong',
      )}
    >
      {checked && <Icon name="check" size="sm" />}
    </span>
  )
}

function SearchInput({
  value,
  onChange,
  loading,
}: {
  value: string
  onChange: (v: string) => void
  loading: boolean
}) {
  return (
    <div className="border-b border-border-base p-xs">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher…"
        aria-label="Rechercher"
        className="w-full rounded-sm px-sm py-xs text-sm outline-none"
      />
      {loading && <span className="sr-only">Chargement…</span>}
    </div>
  )
}

const TRIGGER_BASE =
  'flex w-full items-center justify-between gap-sm rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50'

const TRIGGER_VARIANT = {
  outline: 'border border-border-base bg-surface-base',
  ghost: 'bg-transparent',
  filled: 'bg-surface-raised',
} as const

const TRIGGER_SIZE = {
  sm: 'px-sm py-xs text-sm',
  md: 'px-md py-sm text-base',
  lg: 'px-md py-md text-lg',
} as const
