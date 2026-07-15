import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { AppError, isAppError } from '../errors/app-error.js'

export function notFoundHandler(request: Request, _response: Response, next: NextFunction): void {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route not found: ${request.method} ${request.path}`))
}

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void next
  if (isAppError(error)) {
    response.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        requestId: request.requestId,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    })
    return
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The submitted data is invalid.',
        requestId: request.requestId,
        details: error.flatten(),
      },
    })
    return
  }

  request.log?.error({ err: error, requestId: request.requestId }, 'Unhandled request error')
  response.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong. Please try again.',
      requestId: request.requestId,
    },
  })
}
