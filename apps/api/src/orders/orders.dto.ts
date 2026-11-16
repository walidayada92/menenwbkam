import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
export class OrderLineDto {
  @IsString() @MinLength(1) @MaxLength(100) offerId!: string;
  @IsInt() @Min(1) @Max(1000) quantity!: number;
  @IsString() @Matches(/^\d{1,10}(\.\d{1,2})?$/) expectedUnitPrice!: string;
}
export class CreateOrderDto {
  @IsOptional() @IsUUID() visitorId?: string;
  @IsUUID() checkoutKey!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items!: OrderLineDto[];
  @IsString() @MinLength(2) @MaxLength(120) recipientName!: string;
  @IsString() @Matches(/^\+?[0-9]{8,15}$/) contactPhone!: string;
  @IsString() @MinLength(10) @MaxLength(1000) shippingAddress!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class OrderStatusDto {
  @IsIn(['ACCEPTED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED']) status!:
    'ACCEPTED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  deliveryMethod?: string;
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  trackingNumber?: string;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2000)
  trackingUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
}
export class ReviewDto {
  @IsIn(['SELLER', 'PRODUCT']) target!: 'SELLER' | 'PRODUCT';
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) productId?: string;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() @MinLength(5) @MaxLength(3000) comment!: string;
}
export class ReasonDto {
  @IsString() @MinLength(10) @MaxLength(3000) reason!: string;
}
export class MessageDto {
  @IsString() @MinLength(1) @MaxLength(3000) body!: string;
}
export class DisputeStatusDto {
  @IsIn(['UNDER_REVIEW', 'RESOLVED']) status!: 'UNDER_REVIEW' | 'RESOLVED';
  @IsOptional() @IsString() @MinLength(10) @MaxLength(3000) resolution?: string;
}
export class ModerateReviewDto {
  @IsBoolean() isHidden!: boolean;
  @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional()
  @IsIn([
    'PENDING',
    'ACCEPTED',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'RETURNED',
  ])
  status?:
    'PENDING' | 'ACCEPTED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
}
