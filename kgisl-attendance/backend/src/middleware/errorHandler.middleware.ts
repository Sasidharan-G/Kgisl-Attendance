import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

/** Database constraint failures are the client's conflict to resolve, not a server crash (500). */
export function mapPrismaError(err: unknown): { status: number; code: string; message: string } | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (err.code) {
    case 'P2002':
      return { status: 409, code: 'DUPLICATE_RECORD', message: 'A record with the same details already exists.' };
    case 'P2025':
      return { status: 404, code: 'NOT_FOUND', message: 'The requested record was not found.' };
    case 'P2003':
      return { status: 409, code: 'REFERENCE_CONFLICT', message: 'This record is linked to other data, or refers to something that does not exist.' };
    default:
      return null;
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const prismaProblem = mapPrismaError(err);
  if (prismaProblem) {
    return res.status(prismaProblem.status).json({ success: false, code: prismaProblem.code, message: prismaProblem.message });
  }

  // Malformed JSON bodies and oversized payloads are client mistakes too.
  const httpError = err as { type?: string; status?: number };
  if (httpError?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, code: 'INVALID_JSON', message: 'The request body is not valid JSON.' });
  }
  if (httpError?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' });
  }

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
