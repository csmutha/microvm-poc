import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend applications
  app.enableCors();
  
  // Get port from environment variable or use default
  const port = process.env.PORT || 3000;
  
  // Add service information to the global scope
  app.setGlobalPrefix('api/v1');
  
  await app.listen(port);
  logger.log(`Product Service API is running on port ${port}`);
}
bootstrap();
