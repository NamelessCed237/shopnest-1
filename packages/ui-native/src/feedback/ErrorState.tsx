import { Pressable, Text, View } from 'react-native'
import type { AppError } from '@shopnest/contracts'
import { colors, fontSize, spacing, touchTarget } from '@shopnest/tokens'

export function ErrorState({ error, onRetry }: { error?: AppError; onRetry?: () => void }) {
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md }} accessibilityRole="alert">
      <Text style={{ fontSize: fontSize.sm, color: colors.text.primary }}>
        Impossible de charger les données.
      </Text>
      {error?.code === 'INTERNAL' && (
        <Text style={{ fontSize: fontSize.xs, color: colors.text.secondary }}>
          Code : {error.traceId}
        </Text>
      )}
      {onRetry && (
        <Pressable onPress={onRetry} style={{ minHeight: touchTarget.min, justifyContent: 'center' }}>
          <Text style={{ color: colors.brand.primary, fontSize: fontSize.sm }}>Réessayer</Text>
        </Pressable>
      )}
    </View>
  )
}
