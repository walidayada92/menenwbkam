import { Module } from '@nestjs/common';
import {
  WorkspaceController,
  AnalyticsController,
  WorkspacePublicController,
} from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { AnalyticsService } from './analytics.service';
@Module({
  controllers: [
    WorkspaceController,
    AnalyticsController,
    WorkspacePublicController,
  ],
  providers: [WorkspaceService, AnalyticsService],
})
export class WorkspaceModule {}
