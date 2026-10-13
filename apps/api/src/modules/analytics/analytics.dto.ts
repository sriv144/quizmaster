import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

export class AddCommentDto {
  @IsString()
  @Length(1, 4_000)
  text!: string;

  @IsOptional()
  @IsBoolean()
  private?: boolean;
}

export class SetUserActiveDto {
  @IsBoolean()
  active!: boolean;
}
