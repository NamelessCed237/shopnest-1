import { z } from 'zod'

/**
 * doc/02 §1.6 — FAIL FAST.
 * L'application refuse de démarrer si une variable manque, au lieu de planter
 * en production à la première requête de paiement.
 *
 * ⚠️ Nuance introduite avec Supabase : « fail fast » ne doit pas vouloir dire
 * « impossible de démarrer sans la pile complète ». Redis, Meilisearch, Stripe
 * et le stockage ne sont pas nécessaires pour lire et écrire des produits en
 * développement. Ils restent donc OPTIONNELS en local et deviennent
 * OBLIGATOIRES en staging et en production, où leur absence est un incident.
 */
const BaseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),

  /**
   * Supabase : connexion applicative via le POOLER (port 6543).
   * `?pgbouncer=true&connection_limit=1` est requis — le pooler en mode
   * transaction ne supporte pas les requêtes préparées nommées de Prisma.
   */
  DATABASE_URL: z.string().url(),

  /**
   * Connexion DIRECTE (port 5432), utilisée par `prisma migrate` uniquement.
   * Les migrations posent un verrou consultatif que le pooler ne relaie pas :
   * sans cette URL, `migrate deploy` se bloque sans message d'erreur.
   */
  DIRECT_URL: z.string().url(),

  JWT_CUSTOMER_SECRET: z.string().min(32),
  JWT_TENANT_SECRET: z.string().min(32),
  JWT_ADMIN_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // --- Dépendances non requises pour un développement local ------------------
  REDIS_URL: z.string().url().optional(),
  MEILISEARCH_HOST: z.string().url().optional(),
  MEILISEARCH_API_KEY: z.string().min(1).optional(),

  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),

  MTN_MOMO_BASE_URL: z.string().url().optional(),
  MTN_MOMO_API_KEY: z.string().optional(),
  MTN_MOMO_WEBHOOK_SECRET: z.string().optional(),
  ORANGE_MONEY_BASE_URL: z.string().url().optional(),
  ORANGE_MONEY_API_KEY: z.string().optional(),

  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_BUCKET: z.string().min(1).optional(),
  STORAGE_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_SECRET_KEY: z.string().min(1).optional(),

  APP_BASE_DOMAIN: z.string().default('shopnest.app'),
  CORS_ALLOWED_ORIGINS: z.string().default(''),
})

/** Variables tolérées en local mais indispensables dès qu'il y a de vrais clients. */
const REQUIRED_IN_PRODUCTION = [
  'REDIS_URL',
  'MEILISEARCH_HOST',
  'MEILISEARCH_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STORAGE_ENDPOINT',
  'STORAGE_BUCKET',
  'STORAGE_ACCESS_KEY',
  'STORAGE_SECRET_KEY',
] as const

export const EnvSchema = BaseEnvSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production' && env.NODE_ENV !== 'staging') return

  for (const key of REQUIRED_IN_PRODUCTION) {
    if (env[key]) continue
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [key],
      message: `requis en ${env.NODE_ENV}`,
    })
  }
})

export type Env = z.infer<typeof EnvSchema>

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Configuration invalide — l'application ne démarre pas :\n${details}`)
  }
  return result.data
}
