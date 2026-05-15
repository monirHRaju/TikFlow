import { randomUUID } from 'node:crypto';

import { type NextFunction, type Request, type Response } from 'express';

const HEADER = 'x-request-id';
const VALID = /^[A-Za-z0-9-_]{1,64}$/;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  const id = incoming && VALID.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader(HEADER, id);
  next();
}
