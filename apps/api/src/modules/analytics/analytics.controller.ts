import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard.js";
import type { AuthenticatedRequest } from "../../common/auth.types.js";
import { Roles } from "../../common/roles.decorator.js";
import { Role } from "../../generated/prisma/enums.js";
import { AttemptsService } from "../attempts/attempts.service.js";
import { AddCommentDto, SetUserActiveDto } from "./analytics.dto.js";
import { AnalyticsService } from "./analytics.service.js";

@Controller()
@UseGuards(AuthGuard)
export class LearnerAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("analytics/me")
  @Roles(Role.LEARNER)
  me(@Req() request: AuthenticatedRequest) {
    return this.analytics.learner(request.principal.userId);
  }

  @Get("attempts")
  @Roles(Role.LEARNER)
  history(@Req() request: AuthenticatedRequest) {
    return this.analytics.history(request.principal.userId);
  }
}

@Controller("admin")
@UseGuards(AuthGuard)
@Roles(Role.ADMIN)
export class AdminAnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly attempts: AttemptsService,
  ) {}

  @Get("analytics")
  summary() {
    return this.analytics.admin();
  }

  @Get("users")
  users() {
    return this.analytics.users();
  }

  @Patch("users/:id/active")
  setActive(@Param("id") id: string, @Body() dto: SetUserActiveDto) {
    return this.analytics.setUserActive(id, dto.active);
  }

  @Get("attempts/:id")
  attempt(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.attempts.result(id, request.principal.userId, true);
  }

  @Post("attempts/:id/comments")
  comment(
    @Param("id") id: string,
    @Body() dto: AddCommentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.analytics.addComment(id, request.principal.userId, dto.text, dto.private ?? false);
  }
}
