import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createPinoLogger, NrLoggerService } from './common/logger/nr-logger.service';

async function bootstrap(): Promise<void> {
  const pinoLogger = createPinoLogger();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ loggerInstance: pinoLogger }),
    { logger: new NrLoggerService(pinoLogger) },
  );

  app.use(helmet());
  app.enableCors({ origin: (process.env.ALLOWED_ORIGINS ?? '*').split(',').map((item) => item.trim()) });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SoulTale API')
    .setDescription('SoulTale backend API documentation')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Firebase ID token only (field idToken from signInWithPassword). Paste the JWT alone, without the word Bearer.',
      },
      'bearer',
    )
    // Without this, Swagger UI does not attach Authorization to Try it out requests.
    .addSecurityRequirements('bearer')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
