import { Logger } from '@nestjs/common'
import type { UploadTicket } from '@shopnest/contracts'
import { AppException } from '../../common/errors/app.exception'
import { TICKET_TTL_SECONDS, type StorageDriver, type UploadTicketParams } from './storage.driver'

/**
 * Supabase Storage — pilote de production.
 *
 * Utilise l'API REST directement plutôt que `@supabase/supabase-js` : une
 * seule route est nécessaire, et la bibliothèque cliente tire avec elle un
 * client PostgREST, un client Realtime et un client Auth dont rien ici ne se
 * sert. Trois mégaoctets de dépendances pour un `fetch`.
 */
export class SupabaseStorageDriver implements StorageDriver {
  readonly name = 'supabase'
  private readonly logger = new Logger(SupabaseStorageDriver.name)

  constructor(
    private readonly baseUrl: string,
    private readonly serviceRoleKey: string,
    private readonly bucket: string,
  ) {}

  async createUploadTicket({ key, contentType }: UploadTicketParams): Promise<UploadTicket> {
    /*
     * « Signed upload URL » et non « clé de service transmise au client ».
     *
     * La clé de service contourne toute la RLS de Supabase : entre les mains
     * du navigateur, elle donnerait accès en lecture et en écriture à la base
     * entière, tous vendeurs confondus. Le ticket, lui, ne vaut que pour CE
     * chemin et expire.
     */
    const response = await fetch(
      `${this.baseUrl}/storage/v1/object/upload/sign/${this.bucket}/${key}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: TICKET_TTL_SECONDS }),
      },
    )

    if (!response.ok) {
      // Le corps peut contenir le nom du bucket et un message interne : il va
      // au journal, pas au client, qui reçoit un message générique.
      this.logger.error(`signature refusée (${response.status}) : ${await response.text()}`)
      throw new AppException('INTERNAL', 'storage refused to sign the upload', {
        userMessageKey: 'errors.upload.failed',
      })
    }

    // `url` est RELATIVE à /storage/v1 — ex. « /object/upload/sign/bucket/k?token=… ».
    const { url } = (await response.json()) as { url: string }

    return {
      uploadUrl: `${this.baseUrl}/storage/v1${url}`,
      method: 'PUT',
      /*
       * Le jeton voyage dans l'URL : aucun en-tête d'authentification n'est
       * nécessaire. `x-upsert: false` refuse l'écrasement — la clé étant tirée
       * au sort, une collision signalerait un problème plutôt qu'une reprise.
       */
      headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
      publicUrl: `${this.baseUrl}/storage/v1/object/public/${this.bucket}/${key}`,
      expiresAt: new Date(Date.now() + TICKET_TTL_SECONDS * 1000).toISOString(),
    }
  }
}
