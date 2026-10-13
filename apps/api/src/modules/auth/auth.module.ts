import { Module } from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { EmailService } from "./email.service.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, EmailService, AuthGuard],
  exports: [AuthGuard],
})
export class AuthModule {}
