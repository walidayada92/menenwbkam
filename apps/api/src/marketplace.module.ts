import { Module } from '@nestjs/common';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { AdminController } from './admin/admin.controller';
@Module({
  controllers: [CatalogController, AdminController],
  providers: [CatalogService],
})
export class MarketplaceModule {}
