import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './setup';
async function bootstrap() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (
    process.env.NODE_ENV === 'production' &&
    (process.env.API_PROXY_SECRET?.length || 0) < 32
  )
    throw new Error(
      'API_PROXY_SECRET must contain at least 32 random characters in production',
    );
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  if (process.env.NODE_ENV !== 'production') {
    const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle('Menenwbkam API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, config),
    );
  }
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
}
bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
