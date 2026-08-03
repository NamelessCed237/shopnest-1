/// <reference types="vite/client" />

/**
 * Variables d'environnement du client, typées.
 *
 * Sans cette déclaration, `import.meta.env.VITE_LIVE_DOMAINS` est de type
 * `any` : une faute de frappe dans le nom passerait la compilation et
 * échouerait silencieusement au démarrage.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** Domaines servis par l'API réelle — voir doc/09 §11. */
  readonly VITE_LIVE_DOMAINS?: string
  /** Tenant utilisé en développement, faute de sous-domaine sur localhost. */
  readonly VITE_DEV_TENANT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
