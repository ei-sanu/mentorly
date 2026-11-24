/**
 * HTTP exception classes — drop-in replacements for the @nestjs/common
 * exception API used across the services (getStatus()/getResponse()).
 */
export const HttpStatus = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export class HttpException extends Error {
  private readonly response: string | object;
  private readonly status: number;

  constructor(response: string | object, status: number) {
    super(typeof response === 'string' ? response : (response as any)?.message || 'Http Exception');
    this.response = response;
    this.status = status;
    this.name = new.target.name;
  }

  getStatus(): number {
    return this.status;
  }

  getResponse(): string | object {
    return this.response;
  }
}

function defaultResponse(
  message: string | string[] | object,
  error: string,
  status: number,
): string | object {
  if (typeof message === 'object' && !Array.isArray(message)) return message;
  return { statusCode: status, message, error };
}

export class BadRequestException extends HttpException {
  constructor(message: string | string[] | object = 'Bad Request') {
    super(defaultResponse(message, 'Bad Request', 400), 400);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message: string | object = 'Unauthorized') {
    super(defaultResponse(message, 'Unauthorized', 401), 401);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message: string | object = 'Forbidden resource') {
    super(defaultResponse(message, 'Forbidden', 403), 403);
  }
}

export class NotFoundException extends HttpException {
  constructor(message: string | object = 'Not Found') {
    super(defaultResponse(message, 'Not Found', 404), 404);
  }
}

export class ConflictException extends HttpException {
  constructor(message: string | object = 'Conflict') {
    super(defaultResponse(message, 'Conflict', 409), 409);
  }
}

export class InternalServerErrorException extends HttpException {
  constructor(message: string | object = 'Internal Server Error') {
    super(defaultResponse(message, 'Internal Server Error', 500), 500);
  }
}
