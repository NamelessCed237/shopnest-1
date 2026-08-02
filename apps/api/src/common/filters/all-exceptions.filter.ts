import { randomUUID } from 'node:crypto'
import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import type { AppError } from '@shopnest/contracts'
import { AppException } from '../errors/app.exception'

/**
 * doc/02 §5 — TOUTES les réponses d'erreur sortent au format AppError.
 * Les clients n'ont qu'un seul format à gérer.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()

    if (exception instanceof AppException) {
      // Une erreur d'isolation est un incident de sécurité, pas un 403 ordinaire.
      if (exception.message === 'tenant context missing') {
        this.logger.error({ traceId: exception.traceId }, 'ISOLATION: requête sans contexte tenant')
      }
      response.status(exception.httpStatus).json(exception.toAppError())
      return
    }

    if (exception instanceof HttpException) {
      const traceId = randomUUID()
      const body: AppError = {
        code: exception.getStatus() === 404 ? 'NOT_FOUND' : 'INTERNAL',
        message: exception.message,
        userMessageKey: 'errors.generic',
        traceId,
      }
      response.status(exception.getStatus()).json(body)
      return
    }

    // Inattendu : on journalise la stack complète, on n'en expose rien au client.
    const traceId = randomUUID()
    this.logger.error({ traceId, err: exception }, 'unhandled exception')
    const body: AppError = {
      code: 'INTERNAL',
      message: 'internal server error',
      userMessageKey: 'errors.generic',
      traceId,
    }
    response.status(500).json(body)
  }
}
