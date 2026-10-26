import 'reflect-metadata';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';

// Asegurar que cwd sea la raíz del monorepo para que ./storage/ resuelva a la BD correcta.
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 5; i++) {
    if (existsSync(resolve(dir, '.env'))) return dir;
    dir = dirname(dir);
  }
  return start;
}
const repoRoot = findRepoRoot(process.cwd());
process.chdir(repoRoot);

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/errors/global-exception.filter';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  // WebSocket adapter
  app.useWebSocketAdapter(new WsAdapter(app));

  // CORS
  app.enableCors({ origin: true, credentials: true });

  // OpenAPI (deshabilitado temporalmente por incompatibilidad con Swagger 7.3)
  if (process.env.ENABLE_SWAGGER !== 'false') {
    try {
      const swaggerCfg = new DocumentBuilder()
        .setTitle('Agente Odontológico IA')
        .setDescription('API del agente conversacional para consultorios dentales.')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build();
      const doc = SwaggerModule.createDocument(app, swaggerCfg);
      SwaggerModule.setup('api/docs', app, doc);
    } catch (e) {
      console.warn('Swagger disabled:', (e as Error).message);
    }
  }

  await app.listen(env.APP_PORT);
  logger.log(`🚀 API listening on http://localhost:${env.APP_PORT}`);
  logger.log(`📚 Docs at           http://localhost:${env.APP_PORT}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
