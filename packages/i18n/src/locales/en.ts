export const en: Record<string, string> = {
  'common.retry': 'Retry',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.search': 'Search',
  'common.empty': 'No items',

  'auth.signInTitle': 'Sign in',
  'auth.signInSubtitle': 'Access your store dashboard.',
  'auth.emailLabel': 'Email address',
  'auth.passwordLabel': 'Password',
  'auth.signIn': 'Sign in',
  'auth.signOut': 'Sign out',
  'auth.forgotPasswordHint': 'Forgot your password? Contact your store administrator.',

  'dashboard.placeholder': 'Your management screens will appear here.',

  'errors.generic': 'Something went wrong. Please try again.',
  'errors.network': 'No connection. Check your network.',
  'errors.unauthenticated': 'Your session expired. Please sign in again.',
  'errors.forbidden': 'You do not have access to this resource.',
  'errors.notFound': 'Resource not found.',
  'errors.rateLimited': 'Too many attempts. Try again shortly.',
  'errors.tenantSuspended': 'This store is temporarily unavailable.',
  'errors.planLimitReached': 'Your plan limit is reached. Upgrade to continue.',

  'errors.auth.invalidCredentials': 'Incorrect email or password.',
  'errors.auth.emailTaken': 'An account already exists with this email.',
  'errors.auth.invalidEmail': 'Invalid email address.',
  'errors.auth.passwordTooShort': 'Password must be at least 12 characters.',
  'errors.auth.passwordNeedsLower': 'Password must contain a lowercase letter.',
  'errors.auth.passwordNeedsUpper': 'Password must contain an uppercase letter.',
  'errors.auth.passwordNeedsDigit': 'Password must contain a digit.',
  'errors.auth.mfaRequired': 'Two-factor authentication is required on this account.',
  'errors.auth.invalidMfaCode': 'Invalid or expired verification code.',

  'errors.product.slugTaken': 'This slug is already used by another product.',
  'errors.product.invalidSlug': 'Invalid slug: lowercase letters, digits and hyphens.',
  'errors.tenant.invalidSlug': 'Invalid store identifier.',

  'payment.awaitingConfirmation.title': 'Confirm on your phone',
  'payment.awaitingConfirmation.body':
    'A confirmation request was sent to {phone}. Enter your PIN to complete.',
  'payment.expired': 'The payment request expired. You can try again.',
  'payment.failed': 'The payment did not go through.',

  'products.empty.title': 'No products yet',
  'products.empty.action': 'Create your first product',
}
