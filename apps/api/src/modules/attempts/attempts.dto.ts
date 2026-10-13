import { IsDefined, IsInt, IsOptional, Max, Min } from "class-validator";

export class SaveAnswerDto {
  @IsDefined()
  answer!: unknown;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  timeSpentSeconds?: number;
}
