import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix(config.get<string>('app.apiPrefix') ?? 'api');

  const corsOrigin = config.get<string>('app.corsOrigin') ?? '*';
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const swagger = new DocumentBuilder()
    .setTitle('游戏平台 API')
    .setDescription('微前端游戏平台后端服务')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('app.port') ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`\n  游戏平台后端已启动:  http://127.0.0.1:${port}/api`);
  console.log(`  API 文档(Swagger):  http://127.0.0.1:${port}/docs\n`);
}

void bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('后端启动失败', error);
  process.exit(1);
});
