/**
 * Metro injecte `process.env.EXPO_PUBLIC_*` dans le bundle.
 * Ces variables sont PUBLIQUES par construction — aucun secret ici (doc/05 §4).
 */
declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string
    NODE_ENV?: 'development' | 'production' | 'test'
  }
}
