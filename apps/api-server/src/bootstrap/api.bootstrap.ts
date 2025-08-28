import { NestApplication } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder, SwaggerDocumentOptions } from '@nestjs/swagger';

export class ApiBootstrap {
  static async setupSwagger(app: NestApplication) {
    console.log('📚 Setting up Swagger documentation...');

    const config = new DocumentBuilder()
      .setTitle('ISP Network Management API')
      .setDescription('RESTful API for managing ISP network infrastructure, sites, and links')
      .setVersion('1.0.0')
      .addTag('health', 'Health checks and system status')
      .addTag('sites', 'Network sites and locations')
      .addTag('links', 'Network links and connections')
      .addTag('geography', 'Countries, cities, and regions')
      .addTag('equipment', 'Network equipment and platforms')
      .addServer('http://localhost:3000', 'Development Server')
      .build();

    const options: SwaggerDocumentOptions = {
      operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
      deepScanRoutes: true,
    };

    const document = SwaggerModule.createDocument(app, config, options);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'ISP Network API Documentation',
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info .title { color: #1890ff; }
      `,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    });

    console.log('✅ Swagger UI setup complete at /api/docs');
  }

  static setupGlobalPipes(app: NestApplication) {
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
    }));
  }

  static setupCors(app: NestApplication) {
    app.enableCors({
      origin: [
        'http://localhost:4200', // Angular dev server
        'http://localhost:3000', // API server itself
        'http://localhost:3001', // Alternative port
        'capacitor-electron://-', // For Electron renderer
        'file://', // For file protocol
        '*' // For development (remove in production)
      ],
      credentials: true,
    });
  }

  static async configureApp(app: NestApplication) {
    // Apply all configurations
    ApiBootstrap.setupCors(app);
    ApiBootstrap.setupGlobalPipes(app);
    await ApiBootstrap.setupSwagger(app);
  }
}
