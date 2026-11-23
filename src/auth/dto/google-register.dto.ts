import { IsNotEmpty, IsString } from 'class-validator';
import { SignUpBaseDto } from './sign-up-base.dto.js';

export class GoogleRegisterDto extends SignUpBaseDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
