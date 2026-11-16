import { Module } from '@nestjs/common';
import { SellerService } from './seller.service';
import { SellerController } from './seller.controller';
import { UploadsController } from './uploads.controller';

@Module({
  providers: [SellerService],
  controllers: [SellerController, UploadsController],
})
export class SellerModule {}
