import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  type AppError,
  type ImageMimeType,
  type RequestUploadInput,
  type UploadPurpose,
  type UploadTicket,
} from '@shopnest/contracts'
import type { ApiClient, RequestOptions } from '../client.js'

export function uploadsEndpoints(client: ApiClient) {
  const ticket = (input: RequestUploadInput, options?: RequestOptions) =>
    client.post<UploadTicket>('/uploads/ticket', input, options)

  return {
    ticket,

    /**
     * Envoi complet : ticket, puis dépôt du fichier, puis URL définitive.
     *
     * Les deux étapes sont réunies ici et non dans l'écran appelant. Séparées,
     * chaque application aurait à connaître l'ordre, à reproduire les en-têtes
     * du ticket et à traiter l'échec de la seconde requête — trois occasions
     * de diverger entre le web, le mobile et le bureau, pour une séquence qui
     * n'a qu'une seule façon correcte de se dérouler.
     *
     * Renvoie l'URL PUBLIQUE, seule chose dont l'appelant a besoin : c'est ce
     * qui part dans `imageUrls`.
     */
    upload: async (
      file: File,
      purpose: UploadPurpose = 'product-image',
      options?: RequestOptions,
    ): Promise<string> => {
      /*
       * Contrôles AVANT la demande de ticket.
       *
       * Le serveur revérifie tout — c'est lui qui fait autorité. Mais refuser
       * ici évite un aller-retour, et surtout permet de dire « ce format n'est
       * pas accepté » immédiatement plutôt qu'après avoir transféré 12 Mo sur
       * une connexion mobile pour se les faire refuser à l'arrivée.
       */
      if (!isImageMimeType(file.type)) {
        throw localError('errors.upload.unsupportedType', `unsupported type: ${file.type || '?'}`)
      }
      if (file.size > MAX_IMAGE_BYTES) {
        throw localError('errors.upload.tooLarge', `${file.size} bytes exceeds the limit`)
      }
      if (file.size === 0) {
        throw localError('errors.upload.empty', 'empty file')
      }

      const issued = await ticket(
        { purpose, contentType: file.type, byteSize: file.size },
        options,
      )

      /*
       * `fetch` brut et NON `ApiClient` : cette requête ne part pas vers l'API.
       * Elle vise le stockage, qui ne connaît ni nos jetons — les envoyer
       * ferait fuiter le jeton d'accès vers un tiers — ni notre format
       * d'erreur, ni l'en-tête de tenant.
       */
      const response = await fetch(issued.uploadUrl, {
        method: issued.method,
        headers: issued.headers,
        body: file,
        ...(options?.signal ? { signal: options.signal } : {}),
      })

      if (!response.ok) {
        throw localError('errors.upload.failed', `storage returned HTTP ${response.status}`)
      }

      return issued.publicUrl
    },
  }
}

const isImageMimeType = (value: string): value is ImageMimeType =>
  (IMAGE_MIME_TYPES as readonly string[]).includes(value)

/**
 * Erreur fabriquée côté client, au format `AppError`.
 *
 * Les écrans affichent `t(error.userMessageKey)` sans se demander d'où vient
 * l'erreur : un refus local doit donc avoir exactement la même forme qu'un
 * refus du serveur, sans quoi chaque appelant devrait traiter deux cas.
 */
function localError(userMessageKey: string, message: string): AppError {
  return { code: 'VALIDATION_FAILED', message, userMessageKey, traceId: 'client' }
}
