import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthRequest, RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Req } from '@nestjs/common';
import {
  AddListItemDto,
  CreateListDto,
  PriceAlertDto,
  ProductDto,
  QuantityDto,
} from './shopping.dto';
import { ShoppingService } from './shopping.service';

@UseGuards(RolesGuard)
@Roles('SHOPPER')
@Controller('shopper')
export class ShoppingController {
  constructor(private service: ShoppingService) {}
  @Get('saved') overview(@Req() req: AuthRequest) {
    return this.service.overview(req.user.sub);
  }
  @Get('cart') cart(@Req() req: AuthRequest) {
    return this.service.cart(req.user.sub);
  }
  @Post('cart/items') addCartItem(
    @Req() req: AuthRequest,
    @Body() body: AddListItemDto,
  ) {
    return this.service.addCartItem(req.user.sub, body.offerId, body.quantity);
  }
  @Put('cart/items/:itemId') cartQuantity(
    @Req() req: AuthRequest,
    @Param('itemId') itemId: string,
    @Body() body: QuantityDto,
  ) {
    return this.service.cartQuantity(req.user.sub, itemId, body.quantity);
  }
  @Delete('cart/items/:itemId') removeCartItem(
    @Req() req: AuthRequest,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeCartItem(req.user.sub, itemId);
  }
  @Post('wishlist') wishlist(
    @Req() req: AuthRequest,
    @Body() body: ProductDto,
  ) {
    return this.service.addWishlist(req.user.sub, body.productId);
  }
  @Delete('wishlist/:productId') removeWishlist(
    @Req() req: AuthRequest,
    @Param('productId') productId: string,
  ) {
    return this.service.removeWishlist(req.user.sub, productId);
  }
  @Post('price-alerts')
  priceAlert(@Req() req: AuthRequest, @Body() body: PriceAlertDto) {
    return this.service.priceAlert(
      req.user.sub,
      body.productId,
      body.targetPrice,
    );
  }
  @Delete('price-alerts/:productId')
  removePriceAlert(
    @Req() req: AuthRequest,
    @Param('productId') productId: string,
  ) {
    return this.service.removePriceAlert(req.user.sub, productId);
  }
  @Post('lists') create(@Req() req: AuthRequest, @Body() body: CreateListDto) {
    return this.service.create(req.user.sub, body.name);
  }
  @Delete('lists/:listId') remove(
    @Req() req: AuthRequest,
    @Param('listId') listId: string,
  ) {
    return this.service.removeList(req.user.sub, listId);
  }
  @Post('lists/:listId/items') add(
    @Req() req: AuthRequest,
    @Param('listId') listId: string,
    @Body() body: AddListItemDto,
  ) {
    return this.service.addItem(
      req.user.sub,
      listId,
      body.offerId,
      body.quantity,
    );
  }
  @Put('lists/:listId/items/:itemId') quantity(
    @Req() req: AuthRequest,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
    @Body() body: QuantityDto,
  ) {
    return this.service.quantity(req.user.sub, listId, itemId, body.quantity);
  }
  @Delete('lists/:listId/items/:itemId') removeItem(
    @Req() req: AuthRequest,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeItem(req.user.sub, listId, itemId);
  }
}

@Controller('catalog/shared-lists')
export class SharedShoppingController {
  constructor(private service: ShoppingService) {}
  @Get(':token') shared(@Param('token') token: string) {
    return this.service.shared(token);
  }
}
