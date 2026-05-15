import { type NextFunction, type Request, type Response } from 'express';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    requestId: req.id,
  });
}

type ErrorLike = {
  status?: number;
  statusCode?: number;
  message?: string;
  code?: string;
};

// Express 5 dispatches to the 4-arg error handler when middleware throws or
// rejects. The `_next` is required by the signature even though we don't
// re-dispatch.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const e = (err ?? {}) as ErrorLike;
  const status = e.status ?? e.statusCode ?? 500;

  req.log?.error({ err, status }, 'unhandled error');

  if (res.headersSent) {
    return;
  }
  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : (e.message ?? 'Request failed'),
    requestId: req.id,
  });
}
