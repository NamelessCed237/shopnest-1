import { z } from 'zod'

/**
 * doc/02 §1.6 — FAIL FAST.
 * L'application refuse de démarrer si une variable manque, au lieu de planter
 * en production à la première requête de paiement.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  MEILISEARCH_HOST: z.string().url(),
  MEILISEARCH_API_KEY: z.string().min(1),

  JWT_CUSTOMER_SECRET: z.string().min(32),
  JWT_TENANT_SECRET: z.string().min(32),
  JWT_ADMIN_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),

  MTN_MOMO_BASE_URL: z.string().url().optional(),
  MTN_MOMO_API_KEY: z.string().optional(),
  MTN_MOMO_WEBHOOK_SECRET: z.string().optional(),
  ORANGE_MONEY_BASE_URL: z.string().url().optional(),
  ORANGE_MONEY_API_KEY: z.string().optional(),

  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),

  APP_BASE_DOMAIN: z.string().default('shopnest.app'),
  CORS_ALLOWED_ORIGINS: z.string().default(''),
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
