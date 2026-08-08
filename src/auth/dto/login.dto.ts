import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string | undefined;

  @IsString()
  password: string | undefined;
}