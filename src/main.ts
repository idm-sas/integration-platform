import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { AuthModule } from './auth/auth.module';
import { ProductModule } from './modules/product/product.module';
import { SalesmanModule } from './modules/salesman/salesman.module';
import { RetailerModule } from './modules/retailer/retailer.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: config.get('app.env') === 'production' ? false : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  // Global pipes, filters, interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  // Swagger (hanya di non-production)
  if (config.get('app.env') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SAS iDempiere Integration API')
      .setDescription(`
      The iDempiere Integration API provides a secure interface for integrating external applications with our Enterprise Resource Planning (ERP) system.

      This API enables authorized partners and internal systems to access business data and services through standardized REST endpoints.

      ## Authentication

      All protected endpoints require **Bearer Token** authentication.

      ### Getting Started

      1. Request an access token using **POST /auth/token** with your assigned \`client_id\` and \`client_secret\`.
      2. Include the access token in every request using the following header:

        \`Authorization: Bearer <access_token>\`

      3. The token remains valid for the duration specified by \`expires_in\`. Once expired, request a new token.

      ## Access Control

      - Access permissions are assigned per client.
      - Each client can only access the resources that have been authorized.
      - Requests with invalid or expired tokens will return **401 Unauthorized**.

      ## Development Environment

      Sample client credentials are available after executing the database seed for development and testing purposes.
      `)
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter a valid access token.',
        },
        'Bearer',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      // Hanya include module yang relevan untuk principal
      include: [AuthModule, ProductModule, SalesmanModule, RetailerModule],
      extraModels: [],
    });

    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    logger.log(`Swagger Documentation: http://localhost:${config.get('app.port')}/docs`);
  }

  const port = config.get<number>('app.port') || 3000;
  await app.listen(port);
  logger.log(`App running on port ${port}`);
  logger.log(`Environment: ${config.get('app.env')}`);
}

bootstrap();
