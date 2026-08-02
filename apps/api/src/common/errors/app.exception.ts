import { randomUUID } from 'node:crypto'
import type { AppError, AppErrorCode } from '@shopnest/contracts'
import { HTTP_STATUS_BY_CODE } from '@shopnest/contracts'

/**
 * doc/02 §5 — une seule classe d'exception applicative, sérialisée dans le format
 * AppError partagé avec les clients.
 */
export class AppException extends Error {
  readonly code: AppErrorCode
  readonly userMessageKey: string
  readonly fields: Record<string, string> | undefined
  readonly traceId: string

  constructor(
    code: AppErrorCode,
    message: string,
    options: { userMessageKey?: string; fields?: Record<string, string>; traceId?: string } = {},
  ) {
    super(message)
    this.name = 'AppException'
    this.code = code
    this.userMessageKey = options.userMessageKey ?? DEFAULT_MESSAGE_KEY[code]
    this.fields = options.fields
    this.traceId = options.traceId ?? randomUUID()
  }

  get httpStatus(): number {
    return HTTP_STATUS_BY_CODE[this.code]
  }

  toAppError(): AppError {
    return {
      code: this.code,
      message: this.message,
      userMessageKey: this.userMessageKey,
      ...(this.fields ? { fields: this.fields } : {}),
      traceId: this.traceId,
    }
  }
}

const DEFAULT_MESSAGE_KEY: Record<AppErrorCode, string> = {
  UNAUTHENTICATED: 'errors.unauthenticated',
  FORBIDDEN: 'errors.forbidden',
  NOT_FOUND: 'errors.notFound',
  VALIDATION_FAILED: 'errors.generic',
  CONFLICT: 'errors.generic',
  PLAN_LIMIT_REACHED: 'errors.planLimitReached',
  PAYMENT_FAILED: 'payment.failed',
  TENANT_SUSPENDED: 'errors.tenantSuspended',
  RATE_LIMITED: 'errors.rateLimited',
  INTERNAL: 'errors.generic',
}
