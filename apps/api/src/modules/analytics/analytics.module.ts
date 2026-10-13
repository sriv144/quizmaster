import { Module } from "@nestjs/common";
import { AttemptsModule } from "../attempts/attempts.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AdminAnalyticsController, LearnerAnalyticsController } from "./analytics.controller.js";
import { AnalyticsService } from "./analytics.service.js";

@Module({
  imports: [AuthModule, AttemptsModule],
  controllers: [LearnerAnalyticsController, AdminAnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
