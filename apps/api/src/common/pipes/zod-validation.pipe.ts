import { Injectable, type PipeTransform } from '@nestjs/common'
import type { ZodSchema } from 'zod'
import { AppException } from '../errors/app.exception'

/**
 * doc/02 §11 — toute entrée est validée côté serveur, MÊME si le client valide déjà.
 * Le schéma est celui de @shopnest/contracts : une règle change à un seul endroit.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value)
    if (result.success) return result.data

    // Erreurs par champ → réinjectées dans le formulaire client via form.setError.
    const fields: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.')
      fields[path] ??= issue.message
    }

    throw new AppException('VALIDATION_FAILED', 'payload validation failed', { fields })
  }
}
