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

  /**
   * Stockage des fichiers — Supabase Storage.
   *
   * Les trois sont solidaires : sans elles, le module bascule sur le pilote
   * LOCAL (disque + route statique), ce qui permet de cloner le dépôt et de
   * téléverser une image sans compte Supabase. Ce pilote est refusé en
   * staging et en production, où le disque d'un conteneur est éphémère.
   *
   * ⚠️ `SUPABASE_SERVICE_ROLE_KEY` contourne toute la RLS de Supabase : elle
   * ne quitte JAMAIS le backend. Le navigateur ne reçoit qu'un ticket signé,
   * limité à un seul fichier et à quelques minutes.
   */
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  STORAGE_BUCKET: z.string().min(1).default('product-images'),

  /**
   * URL publique de l'API, telle que le NAVIGATEUR la voit.
   *
   * Le pilote local doit fabriquer des URL absolues — `imageUrls` est un
   * tableau d'URL dans le contrat, et une adresse relative y échouerait à la
   * validation. Le serveur ne peut pas la déduire de `req.host`, qui vaut
   * `localhost` derrière un proxy comme dans un conteneur.
   */
  API_PUBLIC_URL: z.string().url().default('http://localhost:3000/api'),

  /** Racine du pilote local. Relative à `apps/api`. */
  STORAGE_LOCAL_DIR: z.string().default('.storage'),

  /**
   * Boutique publique — où renvoyer l'acheteur après un paiement par carte.
   *
   * Le prestataire héberge le formulaire de carte : c'est lui qui redirige, et
   * il lui faut une adresse absolue. En multi-boutiques cette URL deviendra
   * propre à chaque tenant (sous-domaine ou domaine personnalisé) ; tant que
   * le développement se fait sur `localhost`, une valeur unique suffit.
   */
  STOREFRONT_PUBLIC_URL: z.string().url().default('http://localhost:5173'),

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
  // Sans elles, le stockage retombe sur le disque local : acceptable sur un
  // poste de développement, jamais sur un conteneur dont le disque disparaît
  // au prochain déploiement — les images produit seraient perdues.
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
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
