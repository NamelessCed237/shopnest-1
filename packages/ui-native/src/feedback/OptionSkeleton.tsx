import { View } from 'react-native'
import { colors, radius, spacing } from '@shopnest/tokens'

export function OptionSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={{ gap: spacing.xs }} accessibilityLabel="Chargement">
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{ height: 40, borderRadius: radius.sm, backgroundColor: colors.surface.sunken }}
        />
      ))}
    </View>
  )
}
