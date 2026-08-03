import { cn } from '@shopnest/ui-web'

/**
 * Visuel de remplacement — EN ATTENDANT les vraies photos produit.
 *
 * Un dégradé neutre plutôt qu'une image distante : le mode démonstration ne doit
 * dépendre d'aucun réseau. Le jour où `product.imageUrls` est rempli, ce composant
 * disparaît au profit d'un <img loading="lazy"> avec dimensions explicites (doc/04 §9).
 */

export type MediaTone = 'violet' | 'slate' | 'espresso' | 'stone'

const TONE: Record<MediaTone, string> = {
  violet: 'from-[#3b2f6e] via-[#5b3fa8] to-[#8b5cf6]',
  slate: 'from-[#1f2937] via-[#334155] to-[#64748b]',
  espresso: 'from-[#231a14] via-[#4a352a] to-[#8a6a4f]',
  stone: 'from-[#e7e5e4] via-[#d6d3d1] to-[#a8a29e]',
}

export interface MediaPlaceholderProps {
  tone: MediaTone
  /** Décrit ce que l'image montrera — repris tel quel dans l'alt à terme. */
  label: string
  className?: string
  children?: React.ReactNode
}

export function MediaPlaceholder({ tone, label, className, children }: MediaPlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('relative overflow-hidden bg-gradient-to-br', TONE[tone], className)}
    >
      {/* Grain léger : évite l'aplat de dégradé qui fait « maquette non finie ». */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, #fff 1px, transparent 1px), radial-gradient(circle at 70% 60%, #fff 1px, transparent 1px)',
          backgroundSize: '24px 24px, 32px 32px',
        }}
      />
      {children}
    </div>
  )
}
