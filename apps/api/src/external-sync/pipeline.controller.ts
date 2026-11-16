import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { prisma } from '@menenwbkam/database';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { discoveryUrl } from './discovery';
import { enqueue, queueJob } from './job-queue';
import { scheduleDue } from './pipeline-scheduler';

export class DiscoveryDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsIn(['AMAZON', 'ALMANEA']) store: 'AMAZON' | 'ALMANEA';
  @IsUrl({ protocols: ['https'], require_protocol: true }) startUrl: string;
  @IsOptional() @IsInt() @Min(60) @Max(10080) intervalMinutes?: number;
}
class EnabledDto {
  @IsBoolean() enabled: boolean;
}
class MatchDto {
  @IsString() @MaxLength(100) productId: string;
  @IsString() @MinLength(10) @MaxLength(1000) reason: string;
}

@Controller('admin/external-pipeline')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class PipelineController {
  @Get('status') async status() {
    const [jobs, listings, matched, review, indexed, discoveries] =
      await Promise.all([
        prisma.externalJob.groupBy({ by: ['status'], _count: true }),
        prisma.externalListing.count({ where: { status: 'ACTIVE' } }),
        prisma.externalListing.count({
          where: { status: 'ACTIVE', comparisonProductId: { not: null } },
        }),
        prisma.externalListing.count({
          where: { matchStatus: 'NEEDS_REVIEW', status: 'ACTIVE' },
        }),
        prisma.externalSearchDocument.count(),
        prisma.externalDiscovery.findMany({ orderBy: { createdAt: 'asc' } }),
      ]);
    const hosts = await prisma.externalHostThrottle.findMany();
    return { jobs, listings, matched, review, indexed, discoveries, hosts };
  }
  @Get('jobs') jobs() {
    return prisma.externalJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  @Post('jobs/:id/retry') async retry(@Param('id') id: string) {
    const job = await prisma.externalJob.findUniqueOrThrow({ where: { id } });
    if (job.status !== 'FAILED')
      throw new BadRequestException('Only failed jobs can be retried');
    return prisma.externalJob.create({
      data: { kind: job.kind, payload: job.payload as object },
    });
  }
  @Post('schedule') schedule() {
    return scheduleDue();
  }
  @Get('discoveries') discoveries() {
    return prisma.externalDiscovery.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
  @Post('discoveries') create(@Body() dto: DiscoveryDto) {
    let startUrl: string;
    try {
      startUrl = discoveryUrl(dto.startUrl, dto.store);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid discovery URL',
      );
    }
    return prisma.externalDiscovery.create({
      data: {
        name: dto.name,
        store: dto.store,
        startUrl,
        intervalMinutes: dto.intervalMinutes ?? 1440,
      },
    });
  }
  @Put('discoveries/:id/enabled') enable(
    @Param('id') id: string,
    @Body() dto: EnabledDto,
  ) {
    return prisma.externalDiscovery.update({
      where: { id },
      data: { enabled: dto.enabled, nextRunAt: new Date() },
    });
  }
  @Post('discoveries/:id/run') run(@Param('id') id: string) {
    return queueJob(
      'DISCOVER',
      { discoveryId: id, manual: true },
      `discovery:${id}`,
    );
  }
  @Post('reindex') async reindex() {
    // Work is enqueued in batches; HTTP never performs scraping/matching/indexing.
    let cursor: string | undefined,
      count = 0;
    while (true) {
      const rows = await prisma.externalListing.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!rows.length) break;
      await prisma.$transaction(async (tx) => {
        for (const row of rows)
          await enqueue(tx, 'MATCH', { listingId: row.id });
      });
      count += rows.length;
      cursor = rows[rows.length - 1].id;
    }
    return { queued: count };
  }
  @Get('review') review() {
    return prisma.externalListing.findMany({
      where: { status: 'ACTIVE', matchStatus: 'NEEDS_REVIEW' },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }
  @Get('products') products() {
    return prisma.comparisonProduct.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { _count: { select: { listings: true } } },
    });
  }
  @Put('listings/:id/match') async manualMatch(
    @Param('id') id: string,
    @Body() dto: MatchDto,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
      const old = await tx.externalListing.findUniqueOrThrow({ where: { id } });
      await tx.comparisonProduct.findUniqueOrThrow({
        where: { id: dto.productId },
      });
      const listing = await tx.externalListing.update({
        where: { id },
        data: {
          comparisonProductId: dto.productId,
          matchStatus: 'MANUAL',
          matchReason: dto.reason,
        },
      });
      await tx.externalListingChange.create({
        data: {
          listingId: id,
          kind: 'MANUAL_MATCH',
          before: { productId: old.comparisonProductId },
          after: { productId: dto.productId, reason: dto.reason },
        },
      });
      await enqueue(tx, 'INDEX', { listingId: id });
      return listing;
    });
  }
}
