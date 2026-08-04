import { Body, Controller, Get, Inject, Post, Put, Req, Res, UseGuards } from '@nestjs/common'
import { ThrottlerGuard, Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import {
  MAX_IMAGE_BYTES,
  RequestUploadSchema,
  type RequestUploadInput,
} from '@shopnest/contracts'
import { Public, Roles } from '../../common/decorators'
import { AppException } from '../../common/errors/app.exception'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { LocalStorageDriver } from './local-storage.driver'
import { STORAGE_DRIVER, type StorageDriver } from './storage.driver'
import { UploadsService, isValidStorageKey } from './uploads.service'

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
}

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /**
   * Délivre un ticket d'envoi.
   *
   * Débit VOLONTAIREMENT plus bas que la limite générale (300/min) : un ticket
   * est bon marché à produire mais autorise l'écriture de 5 Mo. Une boucle non
   * bridée remplirait le bucket bien avant que la limite générale ne réagisse.
   *
   * `tenant_staff` y a droit autant que `tenant_admin` : un employé qui saisit
   * les fiches produit doit pouvoir en ajouter les photos.
   */
  @Post('ticket')
  @Roles('tenant_admin', 'tenant_staff')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  ticket(@Body(new ZodValidationPipe(RequestUploadSchema)) dto: RequestUploadInput) {
    return this.uploads.createTicket(dto)
  }

  /**
   * Réception d'un fichier — pilote LOCAL uniquement.
   *
   * `@Public()` et non authentifiée, exactement comme l'URL signée d'un
   * fournisseur externe : l'autorisation tient dans la signature du ticket, qui
   * ne vaut que pour ce chemin, ce type, cette taille et quinze minutes. C'est
   * ce qui permet au pilote local de se comporter comme le vrai — un envoi qui
   * marche ici marchera sur Supabase.
   */
  @Put('local/*key')
  @Public()
  async receiveLocal(@Req() request: Request, @Res() response: Response): Promise<void> {
    const driver = this.requireLocalDriver()
    const key = extractKey(request)

    const { contentType, byteSize } = driver.verifyTicket(key, request.query)

    // Le type déclaré à l'envoi doit être celui pour lequel le ticket a été
    // signé : sinon un ticket obtenu pour une image servirait à déposer autre
    // chose sous une extension d'image.
    if ((request.header('content-type') ?? '').split(';')[0]?.trim() !== contentType) {
      throw new AppException('VALIDATION_FAILED', 'content type does not match the ticket')
    }

    await driver.write(key, request, Math.min(byteSize, MAX_IMAGE_BYTES))
    response.status(201).json({ key })
  }

  /** Lecture — pilote LOCAL uniquement, équivalent d'un bucket public. */
  @Get('local/*key')
  @Public()
  async serveLocal(@Req() request: Request, @Res() response: Response): Promise<void> {
    const driver = this.requireLocalDriver()
    const key = extractKey(request)

    const file = await driver.read(key)
    if (!file) throw new AppException('NOT_FOUND', `no stored file at ${key}`)

    const extension = key.slice(key.lastIndexOf('.') + 1)
    response.type(CONTENT_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream')
    response.setHeader('Content-Length', file.size)

    /*
     * Immuable : la clé contient un UUID tiré au sort et n'est jamais réécrite,
     * donc le contenu d'une URL donnée ne peut pas changer. Remplacer l'image
     * d'un produit produit une NOUVELLE clé.
     */
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

    /*
     * Helmet pose `Cross-Origin-Resource-Policy: same-origin` sur TOUTES les
     * réponses, ce qui est le bon défaut pour une API : cela empêche un site
     * tiers d'incorporer nos réponses JSON. Mais une image produit est faite
     * pour être affichée ailleurs — le dashboard sur le port 5174, et demain
     * la boutique sur son propre domaine. Sans cette exception, le navigateur
     * télécharge l'image puis refuse de la peindre, et la vignette reste
     * vide sans une ligne dans la console.
     *
     * C'est aussi ce que fait un bucket public : le pilote Supabase sert ses
     * fichiers depuis un autre domaine, donc sans restriction d'origine.
     */
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

    file.stream.pipe(response)
  }

  private requireLocalDriver(): LocalStorageDriver {
    if (this.storage instanceof LocalStorageDriver) return this.storage
    // Le pilote distant sert lui-même ses fichiers : exposer ces routes
    // laisserait croire qu'un second chemin d'écriture existe.
    throw new AppException('NOT_FOUND', 'local storage routes are disabled')
  }
}

/**
 * Reconstitue la clé depuis le joker de route.
 *
 * Express 5 — donc Nest 11 — renvoie les jokers nommés sous forme de TABLEAU
 * de segments, là où Express 4 donnait une chaîne. On accepte les deux pour ne
 * pas dépendre d'un détail de version.
 *
 * La clé est ensuite confrontée au motif du service : les tickets sont signés,
 * mais un chemin ne doit jamais atteindre le système de fichiers sans avoir
 * prouvé sa forme — c'est la ceinture, la signature étant les bretelles.
 */
function extractKey(request: Request): string {
  const raw = (request.params as Record<string, unknown>).key
  const key = Array.isArray(raw) ? raw.join('/') : String(raw ?? '')

  if (!isValidStorageKey(key)) {
    throw new AppException('VALIDATION_FAILED', `malformed storage key: ${key}`)
  }
  return key
}
