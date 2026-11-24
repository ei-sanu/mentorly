import { NextFunction, Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '../common/errors';

/**
 * Replicates the old global Nest ValidationPipe configuration:
 * whitelist: true, transform: true, forbidNonWhitelisted: true,
 * enableImplicitConversion: true. Unknown properties and constraint
 * failures produce a BadRequestException whose response message is the
 * array of validation messages (the error handler surfaces the first).
 */
async function runValidation(dtoClass: new () => object, raw: any): Promise<any> {
  const instance: any = plainToInstance(dtoClass, raw ?? {}, {
    enableImplicitConversion: true,
  });

  const messages: string[] = [];

  const allowed = new Set(Object.keys(instance));
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(raw)) {
      if (!allowed.has(key)) {
        messages.push(`property ${key} should not exist`);
      }
    }
  }

  const errors = await validate(instance, { whitelist: true });
  for (const err of errors) {
    if (err.constraints) messages.push(...Object.values(err.constraints));
  }

  if (messages.length > 0) {
    throw new BadRequestException(messages);
  }
  return instance;
}

export function validateBody(dtoClass: new () => object) {
  return (req: Request, _res: Response, next: NextFunction) => {
    runValidation(dtoClass, req.body)
      .then((instance) => {
        req.body = instance;
        next();
      })
      .catch(next);
  };
}

export function validateQuery(dtoClass: new () => object) {
  return (req: Request, _res: Response, next: NextFunction) => {
    runValidation(dtoClass, req.query)
      .then((instance) => {
        (req as any).queryDto = instance;
        next();
      })
      .catch(next);
  };
}
