import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'
import { AppError } from '../errors/app-error.js'

function validationError(details: unknown) {
  return new AppError(400, 'VALIDATION_ERROR', 'The submitted data is invalid.', details)
}

export function validateBody(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const result = schema.safeParse(request.body)
    if (!result.success) {
      next(validationError(result.error.flatten()))
      return
    }
    Object.defineProperty(request, 'body', {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    })
    next()
  }
}

export function validateQuery(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const result = schema.safeParse(request.query)
    if (!result.success) {
      next(validationError(result.error.flatten()))
      return
    }
    Object.defineProperty(request, 'query', {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    })
    next()
  }
}

export function validateParams(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const result = schema.safeParse(request.params)
    if (!result.success) {
      next(validationError(result.error.flatten()))
      return
    }
    Object.defineProperty(request, 'params', {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    })
    next()
  }
}

// Route handlers call this only after validateQuery. Express cannot carry middleware-refined
// query types across handlers, so this provides one explicit, audited boundary for that cast.
export function getValidatedQuery<T>(request: Request): T {
  return request.query as T
}
