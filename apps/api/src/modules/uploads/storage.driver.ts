import type { ImageMimeType, UploadTicket } from '@shopnest/contracts'

/**
 * Contrat d'un fournisseur de stockage.
 *
 * Volontairement RÉDUIT à la délivrance d'un ticket : le backend ne lit ni
 * n'écrit jamais d'octets. Toute la variabilité des fournisseurs — forme de
 * la signature, en-têtes attendus, forme de l'URL publique — reste enfermée
 * derrière ces trois champs, et le navigateur n'en sait rien.
 */
export interface StorageDriver {
  /** Apparaît dans les journaux de démarrage : savoir où partent les fichiers. */
  readonly name: string

  createUploadTicket(params: UploadTicketParams): Promise<UploadTicket>
}

export interface UploadTicketParams {
  /** Chemin dans le bucket, construit par le serveur (voir `uploads.service`). */
  key: string
  contentType: ImageMimeType
  byteSize: number
}

/** Jeton d'injection : `StorageDriver` est une interface, effacée à la compilation. */
export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER')

/**
 * Durée de vie d'un ticket.
 *
 * Assez long pour téléverser 5 Mo sur une connexion mobile lente, assez court
 * pour qu'un ticket récupéré dans un journal proxy ne serve plus à rien le
 * lendemain.
 */
export const TICKET_TTL_SECONDS = 15 * 60
