import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard.js";
import type { AuthenticatedRequest } from "../../common/auth.types.js";
import { Roles } from "../../common/roles.decorator.js";
import { Role } from "../../generated/prisma/enums.js";
import { SaveAnswerDto } from "./attempts.dto.js";
import { AttemptsService } from "./attempts.service.js";

@Controller()
@UseGuards(AuthGuard)
@Roles(Role.LEARNER)
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Post("quizzes/:quizId/attempts")
  start(@Param("quizId") quizId: string, @Req() request: AuthenticatedRequest) {
    return this.attempts.start(quizId, request.principal.userId, {
      ipAddress: request.ip,
      ...(request.headers["user-agent"] ? { deviceInfo: request.headers["user-agent"] } : {}),
    });
  }

  @Get("attempts/:id")
  get(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.attempts.getAttempt(id, request.principal.userId);
  }

  @Put("attempts/:id/answers/:questionId")
  save(
    @Param("id") id: string,
    @Param("questionId") questionId: string,
    @Body() dto: SaveAnswerDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attempts.saveAnswer(id, questionId, request.principal.userId, dto);
  }

  @Post("attempts/:id/submit")
  submit(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.attempts.submit(id, request.principal.userId);
  }

  @Get("attempts/:id/results")
  result(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.attempts.result(id, request.principal.userId);
  }
}
