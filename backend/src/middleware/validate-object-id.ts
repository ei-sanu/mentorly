import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { BadRequestException, NotFoundException } from '../common/errors';

/**
 * Rejects route ids that can never match a MongoDB document BEFORE they
 * reach Mongoose. Without this, a malformed id (a mistyped link, a Clerk
 * id pasted into a URL, a stale card id) flows into findById() or
 * `new Types.ObjectId()` and Mongoose/BSON throws a CastError/BSONError
 * whose raw text ("input must be a 24 character hex string, 12 byte
 * Uint8Array, or an integer") used to reach the user as a 500. The guard
 * answers in plain language instead:
 *
 * - GET (a lookup): 404 — the thing does not exist, same as a valid id
 *   with no document behind it.
 * - Anything else (an action on the id): 400 — the request itself is
 *   malformed and cannot be acted on.
 *
 * The check uses the same rule Mongoose uses to cast, so every id that
 * could match a document still passes through untouched. The global
 * error handler (middleware/error-handler.ts) converts any CastError /
 * BSONError that still slips through (body/query ids, socket payloads)
 * to the same human wording — this middleware is the first line, not
 * the only one.
 *
 * Apply AFTER requireAuth/requireRoles (an unauthenticated request must
 * still 401) and BEFORE the handler, on every route with an :id param.
 * `resourceLabel` is the plain word used in the message, e.g. 'mentor'.
 */
export function validateObjectIdParam(param = 'id', resourceLabel = 'item') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const value = req.params[param];
    if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
      if (req.method === 'GET') {
        return next(
          new NotFoundException(
            `We couldn't find that ${resourceLabel}. It may have been removed.`,
          ),
        );
      }
      return next(
        new BadRequestException(
          `That ${resourceLabel} link looks broken. Please go back and try again.`,
        ),
      );
    }
    next();
  };
}

/**
 * Same idea for an optional ObjectId carried in the query string (the
 * `before` message cursor on GET /conversations/:id/messages). Absent is
 * fine; present-but-malformed is a 400 — the page reference is broken,
 * not the conversation.
 */
export function validateObjectIdQuery(param: string, resourceLabel = 'page reference') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const value = req.query[param];
    if (
      value !== undefined &&
      (typeof value !== 'string' || !Types.ObjectId.isValid(value))
    ) {
      return next(
        new BadRequestException(
          `That ${resourceLabel} looks broken. Please refresh and try again.`,
        ),
      );
    }
    next();
  };
}
