import {
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateListDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
}

export class AddListItemDto {
  @IsString() @MinLength(1) @MaxLength(100) offerId!: string;
  @IsInt() @Min(1) @Max(100) quantity = 1;
}

export class QuantityDto {
  @IsInt() @Min(1) @Max(100) quantity!: number;
}

export class ProductDto {
  @IsString() @MinLength(1) @MaxLength(100) productId!: string;
}

export class ShareTokenDto {
  @IsUUID() token!: string;
}

export class PriceAlertDto {
  @IsString() @MinLength(1) @MaxLength(100) productId!: string;
  @IsString() @Matches(/^\d{1,10}(\.\d{1,2})?$/) targetPrice!: string;
}
