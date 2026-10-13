import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AnalyticsModule } from "./modules/analytics/analytics.module.js";
import { AttemptsModule } from "./modules/attempts/attempts.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { MediaModule } from "./modules/media/media.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    CatalogModule,
    AttemptsModule,
    AnalyticsModule,
    MediaModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
