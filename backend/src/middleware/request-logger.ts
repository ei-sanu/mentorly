import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../common/logger';

const logger = new Logger('HTTP');

/**
 * HTTP request logger — mounted first in app.ts so every request is
 * timed and printed to the `npm run server` terminal when it finishes:
 *   [19:52:03] [INFO] [HTTP] GET /api/v1/me 200 12ms — ADMIN somesh@…
 *
 * Level: 5xx → ERROR, 4xx → WARN, /health → DEBUG (it is polled often),
 * everything else → INFO. The signed-in user (role + email, attached by
 * requireAuth during the request) is appended when known — never the
 * token, and never the request body.
 *
 * Also assigns one requestId per request: it is set on the response
 * header `x-request-id`, and the error handler + 404 handler reuse it so
 * a log line and its error response can be matched up.
 *
 * Socket.IO polling (`/socket.io/...`) is transport noise, not API
 * traffic: successful polls are skipped (socket connects/disconnects are
 * already logged by the gateways); failed polls are still logged.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const isSocketPoll = req.originalUrl.startsWith('/socket.io/');
    if (isSocketPoll && res.statusCode < 400) return;

    const user = (req as any).user;
    const who = user ? ` — ${user.role ?? ''} ${user.email ?? ''}`.trimEnd() : '';
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms${who}`;

    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else if (req.originalUrl === '/api/v1/health') logger.debug(line);
    else logger.log(line);
  });
  next();
}
