import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { toNormalizedEmail } from '../utils/index.js';

export class LoginDto {
  @Transform(toNormalizedEmail)
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
