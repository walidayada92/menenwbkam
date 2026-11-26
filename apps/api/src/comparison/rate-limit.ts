import { Request, Response, NextFunction } from 'express';

// Per-instance protection. Configure the hosting firewall for distributed limits.
export function comparisonRateLimit(limit = 120, windowMs = 60000) {
  const clients = new Map<string, { count: number; until: number }>();
  return (request: Request, response: Response, next: NextFunction) => {
    if (request.path.startsWith('/health/')) return next();
    const now = Date.now();
    if (clients.size >= 10000) {
      for (const [key, value] of clients)
        if (value.until <= now) clients.delete(key);
    }
    const client = request.header('x-mw-client') || '';
    const key =
      process.env.API_PROXY_SECRET && /^[a-f0-9]{64}$/.test(client)
        ? client
        : request.ip || request.socket.remoteAddress || 'unknown';
    let value = clients.get(key);
    if (!value || value.until <= now) {
      if (!value && clients.size >= 10000) {
        response.setHeader('Retry-After', '60');
        return response
          .status(429)
          .json({ message: 'Too many requests. Please retry shortly.' });
      }
      value = { count: 0, until: now + windowMs };
      clients.set(key, value);
    }
    if (++value.count > limit) {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil((value.until - now) / 1000))),
      );
      return response
        .status(429)
        .json({ message: 'Too many requests. Please retry shortly.' });
    }
    next();
  };
}
