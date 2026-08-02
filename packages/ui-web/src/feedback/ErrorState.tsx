import type { AppError } from '@shopnest/contracts'

/**
 * doc/04 §7 — un état d'erreur affiche un message TRADUIT et une action de reprise.
 * On n'affiche jamais error.message (technique) à l'utilisateur.
 */
export function ErrorState({ error, onRetry }: { error?: AppError; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-sm p-md">
      <p className="text-sm text-text-primary">
        {/* TODO(#1): brancher t(error.userMessageKey) via @shopnest/i18n */}
        Impossible de charger les données.
      </p>
      {error?.code === 'INTERNAL' && (
        <p className="text-xs text-text-secondary">Code : {error.traceId}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-medium text-brand-primary underline"
        >
          Réessayer
        </button>
      )}
    </div>
  )
}
