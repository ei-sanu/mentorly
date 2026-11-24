import { NextFunction, Request, Response } from 'express';
import { ForbiddenException } from '../common/errors';
import { Role } from '../database/schemas/user.schema';

/** Port of the old RolesGuard — same checks and messages. */
export function requireRoles(...requiredRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!requiredRoles || requiredRoles.length === 0) {
      return next();
    }

    const user = (req as any).user;

    if (!user) {
      return next(new ForbiddenException('User session not found'));
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      return next(
        new ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(', ')}`),
      );
    }

    return next();
  };
}
