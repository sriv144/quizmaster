import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 120)
  displayName!: string;

  @IsString()
  @Length(10, 128)
  @Matches(/[A-Z]/, { message: "password must contain an uppercase letter" })
  @Matches(/[a-z]/, { message: "password must contain a lowercase letter" })
  @Matches(/\d/, { message: "password must contain a number" })
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @Length(10, 128)
  @Matches(/[A-Z]/)
  @Matches(/[a-z]/)
  @Matches(/\d/)
  password!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  displayName?: string;
}
