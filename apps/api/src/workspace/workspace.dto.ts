import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class WorkspaceDto {
  @IsString() @MinLength(1) @MaxLength(100) sellerId!: string;
}
export class InviteDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsIn(['MANAGER', 'CATALOG', 'ORDERS', 'ANALYST']) role!:
    'MANAGER' | 'CATALOG' | 'ORDERS' | 'ANALYST';
}
export class TeamRoleDto {
  @IsIn(['MANAGER', 'CATALOG', 'ORDERS', 'ANALYST']) role!:
    'MANAGER' | 'CATALOG' | 'ORDERS' | 'ANALYST';
}
export class BrandingDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MinLength(3)
  @MaxLength(60)
  slug!: string;
  @IsOptional()
  @Matches(/^(https:\/\/|\/api\/uploads\/[0-9a-f-]{36}\.(png|jpe?g|webp)$)/)
  @MaxLength(2000)
  logo?: string;
  @IsOptional()
  @Matches(/^(https:\/\/|\/api\/uploads\/[0-9a-f-]{36}\.(png|jpe?g|webp)$)/)
  @MaxLength(2000)
  bannerUrl?: string;
  @IsString() @Matches(/^#[a-fA-F0-9]{6}$/) brandColor!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsInt() @Min(0) @Max(1000) lowStockThreshold!: number;
  @IsBoolean() lowStockAlerts!: boolean;
  @IsBoolean() priceDropAlerts!: boolean;
}
export class RangeDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(366) days = 30;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
}
export class EngagementDto {
  @IsUUID() visitorId!: string;
  @IsIn(['IMPRESSION', 'CLICK']) kind!: 'IMPRESSION' | 'CLICK';
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  offerIds!: string[];
}
