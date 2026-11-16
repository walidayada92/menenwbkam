import { Module } from '@nestjs/common';
import {
  SharedShoppingController,
  ShoppingController,
} from './shopping.controller';
import { ShoppingService } from './shopping.service';
@Module({
  controllers: [ShoppingController, SharedShoppingController],
  providers: [ShoppingService],
})
export class ShoppingModule {}
