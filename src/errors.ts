export type ErrorCode = string

export interface SafeErrorData {
  code: ErrorCode
  message: string
  details?: unknown
}

export class SafeError extends Error {
  readonly code: ErrorCode
  readonly details?: unknown
  constructor(data: SafeErrorData) {
    super(data.message)
    this.code = data.code
    this.details = data.details
  }
}

export function createError(code: ErrorCode, message: string, details?: unknown): SafeError {
  return new SafeError({ code, message, details })
}

export function isSafeError(err: unknown): err is SafeError {
  return err instanceof SafeError
}

export function toSafeError(err: unknown, fallbackCode: ErrorCode = "unknown"): SafeError {
  if (isSafeError(err)) return err
  if (err instanceof Error) return createError(fallbackCode, err.message)
  return createError(fallbackCode, String(err))
}

export interface ErrorPolicy {
  map(code: ErrorCode, err: SafeError): SafeError
}

export function applyPolicy(err: SafeError, policy?: ErrorPolicy): SafeError {
  if (!policy) return err
  return policy.map(err.code, err)
}

