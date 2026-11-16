import { Module } from '@nestjs/common';
import { ExternalSyncController } from './external-sync.controller';
import { ExternalSyncService } from './external-sync.service';
import { ExternalPricesController } from './external-prices.controller';
import { PipelineScheduler } from './pipeline-scheduler';
import { PipelineController } from './pipeline.controller';
import { ComparisonProductsController } from './comparison-products.controller';
@Module({
  controllers: [
    ExternalSyncController,
    ExternalPricesController,
    PipelineController,
    ComparisonProductsController,
  ],
  providers: [ExternalSyncService, PipelineScheduler],
})
export class ExternalSyncModule {}
