import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsNumber,
} from 'class-validator';
export class CheckoutDto {
  @IsString() @MinLength(1) @MaxLength(100) planId!: string;
  @IsIn(['MONTHLY', 'YEARLY']) interval: 'MONTHLY' | 'YEARLY' = 'MONTHLY';
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{1,40}$/) coupon?: string;
}
export class TrialDto {
  @IsString() @MinLength(1) @MaxLength(100) planId!: string;
}
export class PaymentTestDto {
  @IsIn(['paid', 'failed']) outcome!: 'paid' | 'failed';
}
export class TimeTestDto {
  @IsIn(['DUE', 'GRACE_EXPIRED']) stage!: 'DUE' | 'GRACE_EXPIRED';
}
export class PlanDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsString() @MinLength(1) @MaxLength(80) nameAr!: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000)
  monthlyPrice!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1000000) yearlyPrice!: number;
  @IsInt() @Min(-1) @Max(1000000) productLimit!: number;
  @IsObject() features!: Record<string, boolean>;
  @IsBoolean() isActive!: boolean;
  @IsBoolean() isCustom!: boolean;
  @IsInt() @Min(0) @Max(90) trialDays!: number;
  @IsInt() @Min(0) @Max(30) graceDays!: number;
  @IsInt() @Min(0) @Max(100) sortOrder!: number;
}
export class CouponDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,40}$/) code!: string;
  @IsInt() @Min(1) @Max(100) percentOff!: number;
  @IsInt() @Min(1) @Max(1000000) maxRedemptions!: number;
  @IsOptional() @IsISO8601() expiresAt?: string;
  @IsBoolean() isActive!: boolean;
}
