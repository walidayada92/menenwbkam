import { Module } from '@nestjs/common';
import {
  OrdersController,
  OperationsController,
  AdminOperationsController,
  PublicReviewsController,
} from './orders.controller';
import { OrdersService } from './orders.service';
import { ReviewsService } from './reviews.service';
import { DisputesService } from './disputes.service';
@Module({
  controllers: [
    OrdersController,
    OperationsController,
    AdminOperationsController,
    PublicReviewsController,
  ],
  providers: [OrdersService, ReviewsService, DisputesService],
})
export class OrdersModule {}
