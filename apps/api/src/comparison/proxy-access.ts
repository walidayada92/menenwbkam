import { timingSafeEqual } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

export function proxyAccess(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (request.path === '/health/live' || request.path === '/health/ready')
    return next();
  const expected = process.env.API_PROXY_SECRET;
  if (!expected && process.env.NODE_ENV !== 'production') return next();
  const provided = request.header('x-api-key') || '';
  if (
    !expected ||
    Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
    return response.status(401).json({ message: 'Unauthorized' });
  next();
}
