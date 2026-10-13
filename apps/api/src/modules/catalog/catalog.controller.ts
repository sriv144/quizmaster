import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard.js";
import type { AuthenticatedRequest } from "../../common/auth.types.js";
import { Roles } from "../../common/roles.decorator.js";
import { Role } from "../../generated/prisma/enums.js";
import {
  CreateChapterDto,
  CreateQuestionDto,
  CreateQuizDto,
  CreateSubjectDto,
  UpdateQuizDto,
} from "./catalog.dto.js";
import { CatalogService } from "./catalog.service.js";

@Controller()
@UseGuards(AuthGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("subjects")
  subjects(@Req() request: AuthenticatedRequest) {
    return this.catalog.listSubjects(request.principal.role === Role.ADMIN);
  }

  @Get("quizzes/:id")
  quiz(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.catalog.getQuiz(id, request.principal.role);
  }
}

@Controller("admin")
@UseGuards(AuthGuard)
@Roles(Role.ADMIN)
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post("subjects")
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.catalog.createSubject(dto);
  }

  @Post("chapters")
  createChapter(@Body() dto: CreateChapterDto) {
    return this.catalog.createChapter(dto);
  }

  @Post("quizzes")
  createQuiz(@Body() dto: CreateQuizDto, @Req() request: AuthenticatedRequest) {
    return this.catalog.createQuiz(dto, request.principal.userId);
  }

  @Patch("quizzes/:id")
  updateQuiz(@Param("id") id: string, @Body() dto: UpdateQuizDto) {
    return this.catalog.updateQuiz(id, dto);
  }

  @Delete("quizzes/:id")
  deleteQuiz(@Param("id") id: string) {
    return this.catalog.deleteQuiz(id);
  }

  @Post("quizzes/:id/questions")
  createQuestion(@Param("id") id: string, @Body() dto: CreateQuestionDto) {
    return this.catalog.createQuestion(id, dto);
  }

  @Delete("questions/:id")
  deleteQuestion(@Param("id") id: string) {
    return this.catalog.deleteQuestion(id);
  }
}
