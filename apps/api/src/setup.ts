import { INestApplication, ValidationPipe } from '@nestjs/common';
export function configureApp(app: INestApplication) {
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
