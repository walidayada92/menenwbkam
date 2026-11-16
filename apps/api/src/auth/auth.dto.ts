import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Matches(/^\+?[0-9]{8,15}$/) phone!: string;
  @IsString() @MinLength(10) @IsByteLength(10, 72) password!: string;
  @IsIn(['SHOPPER', 'SELLER']) role: 'SHOPPER' | 'SELLER' = 'SHOPPER';
}
export class LoginDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @IsByteLength(1, 72) password!: string;
}
export class UserProfileDto {
  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @Transform(({ value }) => value?.trim())
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/)
  phone!: string;
}
