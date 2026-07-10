import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Known application errors — map to structured HTTP response.
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
  }

  // Zod validation failures — return 422 with field-level detail so the
  // client knows exactly which fields are malformed without exposing internals.
  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Request body is invalid.',
      errors: err.flatten().fieldErrors,
    });
  }

  // Anything else is unexpected — log the full details server-side but
  // never expose stack traces or raw DB errors to the client.
  logger.error('[unhandled_error]', {
    path: req.path,
    error: (err as Error)?.message,
    stack: (err as Error)?.stack,
  });
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong. Please try again.',
  });
}
