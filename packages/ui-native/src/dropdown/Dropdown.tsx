import type { ReactNode } from 'react'
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native'
import {
  useSelect,
  type Option,
  type OptionSource,
  type UseSelectParams,
} from '@shopnest/core'
import { colors, fontSize, radius, spacing, touchTarget } from '@shopnest/tokens'
import { OptionSkeleton } from '../feedback/OptionSkeleton.js'
import { ErrorState } from '../feedback/ErrorState.js'
import { EmptyState } from '../feedback/EmptyState.js'

/**
 * doc/07 §3.5 — jumeau natif du Dropdown web.
 *
 * MÊME hook `useSelect`, MÊMES props. Seul le rendu diffère : convention mobile
 * (feuille du bas) au lieu d'un popover flottant. Un bug de sélection corrigé dans
 * @shopnest/core est corrigé sur les deux plateformes en même temps.
 */

export interface DropdownProps<T = string> {
  source: OptionSource<T>
  value?: T | T[]
  defaultValue?: T | T[]
  onChange?: (value: T | T[]) => void
  multiple?: boolean
  clearable?: boolean
  searchable?: boolean
  creatable?: boolean
  onCreate?: (label: string) => Promise<Option<T>>
  deps?: Record<string, unknown>
  /** Requis uniquement pour une source `{ entity: … }` — fourni par l'app (doc/06 §3). */
  entityResolver?: UseSelectParams<T>['entityResolver']

  label?: string
  placeholder?: string
  helperText?: string
  error?: string
  disabled?: boolean
  required?: boolean

  renderOption?: (
    option: Option<T>,
    state: { selected: boolean; highlighted: boolean },
  ) => ReactNode
  renderEmpty?: () => ReactNode
}

export function Dropdown<T = string>(props: DropdownProps<T>) {
  const { label, placeholder = 'Sélectionner…', error, helperText, renderOption, renderEmpty } = props
  const { state, actions, a11y } = useSelect<T>(props)

  return (
    <View style={{ gap: spacing.xs }}>
      {label && (
        <Text style={{ fontSize: fontSize.sm, color: colors.text.primary }}>
          {label}
          {props.required && <Text style={{ color: colors.status.danger }}> *</Text>}
        </Text>
      )}

      <Pressable
        onPress={actions.open}
        disabled={state.disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: state.isOpen, disabled: state.disabled }}
        style={{
          minHeight: touchTarget.min,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          borderWidth: 1,
          borderColor: error ? colors.status.danger : colors.border.base,
          borderRadius: radius.md,
          backgroundColor: colors.surface.base,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: state.selected.length ? colors.text.primary : colors.text.disabled,
            fontSize: fontSize.base,
          }}
        >
          {formatTrigger(state.selected, placeholder)}
        </Text>
      </Pressable>

      {(error ?? helperText) && (
        <Text
          accessibilityRole={error ? 'alert' : undefined}
          style={{
            fontSize: fontSize.xs,
            color: error ? colors.status.danger : colors.text.secondary,
          }}
        >
          {error ?? helperText}
        </Text>
      )}

      {/* Convention mobile : feuille du bas, pas un popover flottant. */}
      <Modal
        visible={state.isOpen}
        animationType="slide"
        transparent
        onRequestClose={actions.close}
      >
        <Pressable
          onPress={actions.close}
          style={{ flex: 1, backgroundColor: colors.surface.overlay }}
        />
        <View
          style={{
            maxHeight: '70%',
            backgroundColor: colors.surface.base,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing.md,
          }}
        >
          {state.searchable && (
            <TextInput
              value={state.search}
              onChangeText={actions.setSearch}
              placeholder="Rechercher…"
              accessibilityLabel="Rechercher"
              style={{
                minHeight: touchTarget.min,
                paddingHorizontal: spacing.sm,
                borderWidth: 1,
                borderColor: colors.border.base,
                borderRadius: radius.md,
                marginBottom: spacing.sm,
              }}
            />
          )}

          {/* Les quatre états — identiques au web (doc/07 R5) */}
          {state.status === 'loading' && <OptionSkeleton count={5} />}
          {state.status === 'error' && <ErrorState error={state.error} onRetry={actions.retry} />}
          {state.status === 'empty' && (renderEmpty?.() ?? <EmptyState search={state.search} />)}

          {state.status === 'success' && (
            <FlatList
              data={state.options}
              keyExtractor={(item) => String(item.value)}
              onEndReached={actions.fetchNextPage}
              onEndReachedThreshold={0.4}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => actions.select(item)}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: a11y.option(index)['aria-selected'] }}
                  style={{
                    minHeight: touchTarget.min,
                    justifyContent: 'center',
                    paddingVertical: spacing.sm,
                  }}
                >
                  {renderOption?.(item, {
                    selected: state.isSelected(item),
                    highlighted: false,
                  }) ?? (
                    <Text style={{ fontSize: fontSize.base, color: colors.text.primary }}>
                      {item.label}
                      {state.isSelected(item) && '  ✓'}
                    </Text>
                  )}
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  )
}

function formatTrigger<T>(selected: Option<T>[], placeholder: string): string {
  if (selected.length === 0) return placeholder
  if (selected.length === 1) return selected[0]?.label ?? placeholder
  return `${selected.length} sélectionnés`
}
