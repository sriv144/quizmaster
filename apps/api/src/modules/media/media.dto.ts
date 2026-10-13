import { IsInt, IsString, Length, Max, Min } from "class-validator";

export class UploadIntentDto {
  @IsString()
  @Length(1, 180)
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(5_242_880)
  sizeBytes!: number;
}

export class FinalizeUploadDto {
  @IsString()
  objectKey!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(5_242_880)
  sizeBytes!: number;
}
