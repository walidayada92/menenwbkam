import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
} from 'class-validator';
export class SellerProfileDto {
  @IsString() @MinLength(2) @MaxLength(160) businessName!: string;
  @IsString() @Matches(/^[0-9]{10}$/) commercialRegNo!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
export class OfferDto {
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsString() @MinLength(1) @MaxLength(100) brandId!: string;
  @IsString() @MinLength(1) @MaxLength(100) categoryId!: string;
  @IsOptional()
  @IsString()
  @Matches(/^([0-9]{8}|[0-9]{12,14})$/)
  barcode?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionAr?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionEn?: string;
  @IsArray()
  @ArrayMaxSize(8)
  @Matches(/^(https:\/\/|\/api\/uploads\/[0-9a-f-]{36}\.(png|jpe?g|webp)$)/, {
    each: true,
  })
  images!: string[];
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  price!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000000) stock!: number;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2000)
  productUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) sku?: string;
}
export class SearchDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() @MaxLength(100) brandId?: string;
  @IsOptional() @IsString() @MaxLength(100) categoryId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;
  @IsOptional()
  @IsString()
  @Matches(/^(price_asc|price_desc|newest)$/)
  sort?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
}
