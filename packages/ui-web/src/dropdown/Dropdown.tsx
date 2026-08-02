import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import * as Popover from '@radix-ui/react-popover'
import {
  useSelect,
  type Option,
  type OptionSource,
  type UseSelectParams,
} from '@shopnest/core'
import { Field } from '../field/Field.js'
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

export interface DropdownProps<T = string> {
  /** R1 — une SOURCE, pas des données. Statique | fonction | query | entity. */
  source: OptionSource<T>

  // R4 — contrôlé ou non contrôlé
  value?: T | T[]
  defaultValue?: T | T[]
  onChange?: (value: T | T[]) => void

  multiple?: boolean
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
}

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

  const listRef = useRef<HTMLUListElement>(null)
  const { state, actions, a11y, keyboard } = useSelect<T>(props)

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
              <TriggerContent selected={state.selected} placeholder={placeholder} />
            )}
            <ChevronIcon open={state.isOpen} />
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
                  }) ?? <DefaultOption option={option} selected={state.isSelected(option)} />}
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
              Créer « {state.search} »
            </button>
          )}
        </Popover.Content>
      </Popover.Root>
    </Field>
  )
}

// --- Sous-composants privés --------------------------------------------------

function TriggerContent<T>({
  selected,
  placeholder,
}: {
  selected: Option<T>[]
  placeholder: string
}) {
  if (selected.length === 0) {
    return <span className="text-text-disabled">{placeholder}</span>
  }
  if (selected.length === 1) return <span className="truncate">{selected[0]?.label}</span>
  return <span className="truncate">{selected.length} sélectionnés</span>
}

function DefaultOption<T>({ option, selected }: { option: Option<T>; selected: boolean }) {
  return (
    <div className="flex items-center justify-between gap-sm">
      <div className="min-w-0">
        <div className="truncate text-sm text-text-primary">{option.label}</div>
        {option.description && (
          <div className="truncate text-xs text-text-secondary">{option.description}</div>
        )}
      </div>
      {selected && <CheckIcon />}
    </div>
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

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    className={cn('h-4 w-4 shrink-0 transition-transform', { 'rotate-180': open })}
  >
    <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const CheckIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 text-brand-primary">
    <path d="M5 10l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
)

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
