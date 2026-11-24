import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { HttpException, HttpStatus } from '../common/errors';
import { Logger } from '../common/logger';

const logger = new Logger('ExceptionHandler');

/**
 * Port of the old Nest HttpExceptionFilter — identical response shape:
 * { success: false, error: { code, message }, requestId }
 */
export function errorHandler(
  exception: any,
  request: Request,
  response: Response,
  _next: NextFunction,
) {
  // A malformed MongoDB id reached a query (Mongoose CastError, or the
  // raw BSONError from `new Types.ObjectId()` — "input must be a 24
  // character hex string, 12 byte Uint8Array, or an integer"). The
  // validateObjectIdParam middleware is supposed to catch these before
  // the service layer; this is the safety net for ids arriving any other
  // way (request bodies, query cursors, socket payloads). The user gets
  // the same plain wording as the guard — never the cast text, never a
  // 500 — while the full technical detail stays in the server log only.
  const isObjectIdError =
    exception?.name === 'CastError' ||
    exception?.name === 'BSONError' ||
    exception?.kind === 'ObjectId';

  const status = isObjectIdError
    ? request.method === 'GET'
      ? HttpStatus.NOT_FOUND
      : HttpStatus.BAD_REQUEST
    : exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

  const requestId =
    (request as any).requestId || (request.headers['x-request-id'] as string) || uuidv4();

  let message = 'Internal server error';
  let code = 'INTERNAL_SERVER_ERROR';

  if (isObjectIdError) {
    message =
      request.method === 'GET'
        ? "We couldn't find what you were looking for. It may have been removed."
        : 'That link looks broken. Please go back and try again.';
    code = request.method === 'GET' ? 'Not Found' : 'Bad Request';
    logger.error(
      `ObjectId cast error on ${request.method} ${request.url} - Error: ${exception?.stack || exception}`,
    );
  } else if (exception instanceof HttpException) {
    const resContent: any = exception.getResponse();
    if (typeof resContent === 'string') {
      message = resContent;
    } else if (typeof resContent === 'object') {
      message = resContent.message || exception.message;
      code = resContent.error || 'BAD_REQUEST';
    }
  } else {
    message = exception?.message || 'An unexpected error occurred';
    logger.error(
      `Unhandled exception on ${request.method} ${request.url} - Error: ${exception?.stack || exception}`,
    );
  }

  response.status(status).json({
    success: false,
    error: {
      code,
      message: Array.isArray(message) ? message[0] : message,
    },
    requestId,
  });
}
