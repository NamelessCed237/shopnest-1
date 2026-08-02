/** Clés hiérarchiques et stables — doc/04 §10. */
export const fr: Record<string, string> = {
  'common.retry': 'Réessayer',
  'common.cancel': 'Annuler',
  'common.save': 'Enregistrer',
  'common.search': 'Rechercher',
  'common.empty': 'Aucun élément',

  'auth.signInTitle': 'Connexion',
  'auth.signInSubtitle': 'Accédez au tableau de bord de votre boutique.',
  'auth.emailLabel': 'Adresse email',
  'auth.passwordLabel': 'Mot de passe',
  'auth.signIn': 'Se connecter',
  'auth.signOut': 'Se déconnecter',
  'auth.forgotPasswordHint': 'Mot de passe oublié ? Contactez l’administrateur de votre boutique.',

  'dashboard.placeholder': 'Vos écrans de gestion apparaîtront ici.',

  'errors.generic': 'Une erreur est survenue. Veuillez réessayer.',
  'errors.network': 'Connexion indisponible. Vérifiez votre réseau.',
  'errors.unauthenticated': 'Votre session a expiré. Reconnectez-vous.',
  'errors.forbidden': "Vous n'avez pas accès à cette ressource.",
  'errors.notFound': 'Ressource introuvable.',
  'errors.rateLimited': 'Trop de tentatives. Réessayez dans quelques instants.',
  'errors.tenantSuspended': 'Cette boutique est momentanément indisponible.',
  'errors.planLimitReached': 'Votre plan a atteint sa limite. Passez à un plan supérieur.',

  'errors.auth.invalidCredentials': 'Email ou mot de passe incorrect.',
  'errors.auth.emailTaken': 'Un compte existe déjà avec cet email.',
  'errors.auth.invalidEmail': 'Adresse email invalide.',
  'errors.auth.passwordTooShort': 'Le mot de passe doit contenir au moins 12 caractères.',
  'errors.auth.passwordNeedsLower': 'Le mot de passe doit contenir une minuscule.',
  'errors.auth.passwordNeedsUpper': 'Le mot de passe doit contenir une majuscule.',
  'errors.auth.passwordNeedsDigit': 'Le mot de passe doit contenir un chiffre.',
  'errors.auth.mfaRequired': 'Double authentification requise sur ce compte.',
  'errors.auth.invalidMfaCode': 'Code de validation incorrect ou expiré.',

  'errors.product.slugTaken': 'Cette adresse est déjà utilisée par un autre produit.',
  'errors.product.invalidSlug': 'Adresse invalide : lettres minuscules, chiffres et tirets.',
  'errors.tenant.invalidSlug': 'Identifiant de boutique invalide.',

  'payment.awaitingConfirmation.title': 'Validez sur votre téléphone',
  'payment.awaitingConfirmation.body':
    'Une demande de confirmation a été envoyée au {phone}. Saisissez votre code pour finaliser.',
  'payment.expired': 'La demande de paiement a expiré. Vous pouvez réessayer.',
  'payment.failed': "Le paiement n'a pas abouti.",

  'products.empty.title': 'Aucun produit pour le moment',
  'products.empty.action': 'Créer votre premier produit',
}
