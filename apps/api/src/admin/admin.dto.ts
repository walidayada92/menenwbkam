import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
export class ReviewDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED';
}
export class MergeDto {
  @IsString() @MinLength(1) @MaxLength(100) sourceId!: string;
  @IsString() @MinLength(1) @MaxLength(100) targetId!: string;
}
export class TaxonomyDto {
  @IsString() @MinLength(1) @MaxLength(120) nameAr!: string;
  @IsString() @MinLength(1) @MaxLength(120) nameEn!: string;
}
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
export class AdminPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
}
