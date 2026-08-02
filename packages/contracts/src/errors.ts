import { z } from 'zod'

/**
 * doc/02 §5 — un format d'erreur unique pour toute l'API.
 * Les clients n'ont qu'un seul cas à gérer (DRY appliqué à la gestion d'erreur).
 */
export const APP_ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'CONFLICT',
  'PLAN_LIMIT_REACHED',
  'PAYMENT_FAILED',
  'TENANT_SUSPENDED',
  'RATE_LIMITED',
  'INTERNAL',
] as const

export type AppErrorCode = (typeof APP_ERROR_CODES)[number]

export const AppErrorSchema = z.object({
  code: z.enum(APP_ERROR_CODES),
  /** Message technique — journalisé, jamais affiché tel quel à l'utilisateur. */
  message: z.string(),
  /** Clé i18n du message destiné à l'utilisateur. Le backend ne renvoie jamais de texte final. */
  userMessageKey: z.string(),
  /** Erreurs par champ, réinjectées dans les formulaires via form.setError. */
  fields: z.record(z.string()).optional(),
  /** Identifiant de corrélation — affiché à l'utilisateur sur les erreurs INTERNAL. */
  traceId: z.string(),
})
export type AppError = z.infer<typeof AppErrorSchema>

/** Correspondance code → statut HTTP, partagée par le filtre Nest et le client. */
export const HTTP_STATUS_BY_CODE: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  // Volontairement 404 et non 403 pour une ressource d'un autre tenant :
  // un 403 confirmerait son existence (fuite d'information). Voir doc/08 §3.
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  CONFLICT: 409,
  PLAN_LIMIT_REACHED: 402,
  PAYMENT_FAILED: 402,
  TENANT_SUSPENDED: 403,
  RATE_LIMITED: 429,
  INTERNAL: 500,
}

export function isAppError(value: unknown): value is AppError {
  return AppErrorSchema.safeParse(value).success
}
