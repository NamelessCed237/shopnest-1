import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { colors, fontSize, spacing } from '@shopnest/tokens'

export function EmptyState({
  search,
  title,
  action,
}: {
  search?: string
  title?: string
  action?: ReactNode
}) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.md }}>
      <Text style={{ fontSize: fontSize.sm, color: colors.text.secondary }}>
        {title ?? (search ? `Aucun résultat pour « ${search} »` : 'Aucun élément')}
      </Text>
      {action}
    </View>
  )
}
