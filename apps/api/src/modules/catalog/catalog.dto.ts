import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import {
  AnswerRevealPolicy,
  QuestionType,
  QuizStatus,
  QuizType,
} from "../../generated/prisma/enums.js";

export class CreateSubjectDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  code?: string;
}

export class CreateChapterDto {
  @IsUUID()
  subjectId!: string;

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;
}

export class CreateQuizDto {
  @IsUUID()
  chapterId!: string;

  @IsString()
  @Length(2, 160)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsEnum(QuizType)
  type?: QuizType;

  @IsOptional()
  @IsDateString()
  opensAt?: string;

  @IsOptional()
  @IsDateString()
  closesAt?: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  durationSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingPercent?: number;

  @IsOptional()
  @IsEnum(AnswerRevealPolicy)
  revealPolicy?: AnswerRevealPolicy;

  @IsOptional()
  @IsBoolean()
  randomizeQuestions?: boolean;
}

export class UpdateQuizDto extends CreateQuizDto {
  @IsOptional()
  declare chapterId: string;

  @IsOptional()
  declare title: string;

  @IsOptional()
  @IsEnum(QuizStatus)
  status?: QuizStatus;
}

export class QuestionOptionDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @Length(1, 500)
  text!: string;

  @IsInt()
  @Min(1)
  position!: number;

  @IsBoolean()
  isCorrect!: boolean;
}

export class CreateQuestionDto {
  @IsString()
  @Length(1, 10_000)
  prompt!: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsNumber()
  @Min(0.01)
  marks!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  negativeMarks?: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;

  @IsOptional()
  @IsInt()
  correctInteger?: number;

  @IsOptional()
  @IsBoolean()
  correctBoolean?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];
}
