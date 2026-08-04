import { z } from 'zod'

/**
 * Envoi de fichiers — doc/03 §2.
 *
 * L'API ne reçoit JAMAIS les octets. Elle délivre un TICKET : une URL d'écriture
 * à durée de vie courte, que le navigateur utilise pour téléverser directement
 * vers le stockage.
 *
 * Faire transiter les images par le backend coûterait trois fois : la bande
 * passante est payée deux fois (client → API, API → stockage), un fichier de
 * 5 Mo monopolise un worker Node pendant tout l'envoi — sur une connexion
 * mobile africaine, cela peut faire une minute — et la limite de taille du
 * corps de requête devrait être relevée pour TOUTES les routes, y compris
 * celles qui n'attendent qu'un objet JSON de deux champs.
 */

/**
 * Types acceptés.
 *
 * Liste BLANCHE et non liste noire : `image/svg+xml` est un document XML qui
 * peut porter du script, et servi depuis le même domaine que la boutique il
 * s'exécuterait dans son contexte. Il n'est donc pas ici, et n'y sera pas.
 */
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number]

/** 5 Mo — au-delà, c'est une photo non redimensionnée, pas une image produit. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Doit rester aligné sur `ProductSchema.imageUrls.max(10)`. */
export const MAX_PRODUCT_IMAGES = 10

const EXTENSIONS: Record<ImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

/**
 * Extension déduite du TYPE DÉCLARÉ, jamais du nom de fichier envoyé.
 *
 * Un nom de fichier vient du poste client : il peut contenir `../`, un
 * caractère nul, ou une double extension `photo.png.html`. Le type MIME est
 * lui validé contre la liste blanche ci-dessus, donc la table est totale.
 */
export function imageExtension(contentType: ImageMimeType): string {
  return EXTENSIONS[contentType]
}

/**
 * `purpose` plutôt qu'un chemin libre.
 *
 * Laisser le client choisir l'emplacement, c'est le laisser écrire où il veut
 * dans le bucket. Le serveur construit la clé lui-même à partir du tenant, de
 * l'usage et d'un identifiant tiré au sort.
 */
export const UPLOAD_PURPOSES = ['product-image'] as const
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number]

export const RequestUploadSchema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES),
  contentType: z.enum(IMAGE_MIME_TYPES, {
    errorMap: () => ({ message: 'errors.upload.unsupportedType' }),
  }),
  /**
   * Taille annoncée AVANT l'envoi, pour refuser un fichier trop lourd sans
   * l'avoir transféré. Le stockage la revérifie à la réception : cette valeur
   * vient du client et ne prouve rien à elle seule.
   */
  byteSize: z
    .number()
    .int()
    .positive()
    .max(MAX_IMAGE_BYTES, { message: 'errors.upload.tooLarge' }),
})
export type RequestUploadInput = z.infer<typeof RequestUploadSchema>

export const UploadTicketSchema = z.object({
  /** URL d'écriture à usage unique. */
  uploadUrl: z.string().url(),
  method: z.enum(['PUT', 'POST']),
  /**
   * En-têtes à reproduire tels quels sur la requête d'envoi.
   *
   * Ils diffèrent selon le fournisseur — jeton dans `Authorization` chez l'un,
   * signature dans l'URL chez l'autre. Les renvoyer depuis le serveur évite
   * au client de connaître le fournisseur, et permet d'en changer sans
   * republier les applications.
   */
  headers: z.record(z.string()).default({}),
  /** URL de lecture définitive, à stocker dans `imageUrls` une fois l'envoi réussi. */
  publicUrl: z.string().url(),
  expiresAt: z.string().datetime(),
})
export type UploadTicket = z.infer<typeof UploadTicketSchema>
