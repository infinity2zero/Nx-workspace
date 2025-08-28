import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ApiBootstrap } from './bootstrap/api.bootstrap';

async function bootstrap() {
  console.log('🚀 Starting standalone NestJS API Server...');
  
  const app:any = await NestFactory.create(AppModule);
    
  // Use shared configuration
  await ApiBootstrap.configureApp(app);

  const port = process.env['PORT'] || 3000; // Different port for standalone
  await app.listen(port);
  
  console.log('🚀 Standalone ISP Network API Server started!');
  console.log(`📖 Swagger Documentation: http://localhost:${port}/api/docs`);
  console.log(`🔍 Health Check: http://localhost:${port}/api/health`);
}

bootstrap().catch(err => {
  console.error('❌ Failed to start application:', err);
});
//^\/api/[0-9 a-z A-Z \/]*
