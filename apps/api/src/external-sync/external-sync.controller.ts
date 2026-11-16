import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { prisma } from '@menenwbkam/database';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ExternalSyncService } from './external-sync.service';
import { queueJob } from './job-queue';
import {
  CreateExternalSourceDto,
  EnableExternalSourceDto,
} from './external-sync.dto';

@Controller('admin/external-sources')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class ExternalSyncController {
  constructor(private readonly sync: ExternalSyncService) {}
  @Get() list() {
    return prisma.externalSource.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  @Post() create(@Body() dto: CreateExternalSourceDto) {
    return this.sync.create(dto);
  }
  @Put(':id/enabled') enable(
    @Param('id') id: string,
    @Body() dto: EnableExternalSourceDto,
  ) {
    return prisma.externalSource.update({
      where: { id },
      data: { enabled: dto.enabled, nextRunAt: new Date() },
    });
  }
  @Post(':id/sync') run(@Param('id') id: string) {
    return queueJob('SYNC', { sourceId: id, manual: true }, `source:${id}`);
  }
  @Get(':id/listings') listings(@Param('id') id: string) {
    return prisma.externalListing.findMany({
      where: { sourceId: id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { changes: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
  }
  @Get(':id/runs') runs(@Param('id') id: string) {
    return prisma.externalSyncRun.findMany({
      where: { sourceId: id },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }
}
