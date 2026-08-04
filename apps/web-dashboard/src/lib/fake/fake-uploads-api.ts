import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  type AppError,
  type UploadPurpose,
} from '@shopnest/contracts'

/**
 * Envoi d'images en mode démonstration.
 *
 * Le fichier n'est envoyé NULLE PART : il est converti en URL `data:` et vit
 * dans la page. C'est volontaire — un mode démonstration qui exige un bucket,
 * une clé de service et un compte Supabase n'est plus une démonstration.
 *
 * `data:image/png;base64,…` passe la validation `z.string().url()` du contrat
 * (`new URL()` accepte le schéma `data:`), donc `imageUrls` reste conforme et
 * le formulaire se comporte exactement comme en mode réel.
 *
 * La limite : ces URL sont lourdes et disparaissent au rechargement, puisque
 * le catalogue factice vit en mémoire. C'est le comportement attendu de la
 * démonstration, pas un défaut à corriger.
 */

const LATENCY_MS = 600

function fail(userMessageKey: string, message: string): never {
  const error: AppError = {
    code: 'VALIDATION_FAILED',
    message: `[fake-api] ${message}`,
    userMessageKey,
    traceId: crypto.randomUUID(),
  }
  throw error
}

export const fakeUploadEndpoints = {
  /*
   * Les MÊMES contrôles que le vrai client, et pour la même raison qu'ailleurs
   * dans cette API factice : une version complaisante laisserait passer un
   * fichier de 20 Mo en démonstration, et l'écran ne montrerait jamais son
   * message d'erreur avant d'arriver en production.
   */
  upload: async (file: File, _purpose: UploadPurpose = 'product-image'): Promise<string> => {
    if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      fail('errors.upload.unsupportedType', `unsupported type: ${file.type || '?'}`)
    }
    if (file.size > MAX_IMAGE_BYTES) {
      fail('errors.upload.tooLarge', `${file.size} bytes`)
    }
    if (file.size === 0) {
      fail('errors.upload.empty', 'empty file')
    }

    await new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(fail('errors.upload.failed', 'FileReader failed'))
      reader.readAsDataURL(file)
    })
  },
}
