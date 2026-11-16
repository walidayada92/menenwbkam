import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class CreateExternalSourceDto {
  @IsString() @MaxLength(120) name: string;
  @IsIn(['AMAZON', 'NOON', 'ALMANEA', 'EXTRA', 'TRENDYOL']) store:
    'AMAZON' | 'NOON' | 'ALMANEA' | 'EXTRA' | 'TRENDYOL';
  @IsArray()
  @ArrayMaxSize(25)
  @ArrayUnique()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  productUrls: string[];
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  sitemapUrls: string[];
  @IsOptional() @IsInt() @Min(60) @Max(10080) intervalMinutes?: number;
}
export class EnableExternalSourceDto {
  @IsBoolean() enabled: boolean;
}
