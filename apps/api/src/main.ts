import "reflect-metadata";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true, trustProxy: true }),
  );
  const config = app.get(ConfigService);

  await app.register(cookie, { secret: config.getOrThrow<string>("SESSION_SECRET") });
  await app.register(helmet, { contentSecurityPolicy: false });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  if (config.get("NODE_ENV") !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("QuizMaster API")
      .setVersion("1.0")
      .addCookieAuth("qm_session")
      .build();
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  await app.listen(config.get<number>("PORT", 3000), "0.0.0.0");
}

await bootstrap();
