import { Module } from '@nestjs/common';
import {
  AdminBillingController,
  SellerBillingController,
} from './billing.controller';
import { BillingService } from './billing.service';
@Module({
  controllers: [AdminBillingController, SellerBillingController],
  providers: [BillingService],
})
export class BillingModule {}
