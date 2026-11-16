import { Module, OnApplicationShutdown } from '@nestjs/common';
import { prisma } from '@menenwbkam/database';
import { ComparisonController } from './comparison.controller';
import { ExternalPricesController } from '../external-sync/external-prices.controller';
import { ComparisonProductsController } from '../external-sync/comparison-products.controller';

// No authentication, registration, marketplace or admin controllers in this release.
@Module({
  controllers: [
    ComparisonController,
    ExternalPricesController,
    ComparisonProductsController,
  ],
})
export class ComparisonModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await prisma.$disconnect();
  }
}
