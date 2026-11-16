import { INestApplication, ValidationPipe } from '@nestjs/common';
import { comparisonRateLimit } from './comparison/rate-limit';
import { proxyAccess } from './comparison/proxy-access';
export function configureApp(app: INestApplication) {
  app.use(proxyAccess);
  app.use(comparisonRateLimit());
  app.use(
    (
      _request: unknown,
      response: { setHeader(name: string, value: string): void },
      next: () => void,
    ) => {
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('X-Frame-Options', 'DENY');
      next();
    },
  );
  app.enableCors({
    origin: (process.env.WEB_ORIGIN || 'http://localhost:3001').split(','),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
