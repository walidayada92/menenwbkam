import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { prisma } from '@menenwbkam/database';
import { enqueue } from './job-queue';
import { hostRetryAt, nextCrawl } from './crawl-policy';
import { stores, Store } from './public-store';

export async function scheduleDue() {
  const now = new Date();
  const limits = await prisma.externalHostThrottle.findMany();
  const pausedUntil = new Map(
    limits.map((row) => [row.host, hostRetryAt(row, now.getTime())]),
  );
  const [discoveries, sources] = await Promise.all([
    prisma.externalDiscovery.findMany({
      where: { enabled: true, nextRunAt: { lte: now } },
      take: 100,
    }),
    prisma.externalSource.findMany({
      where: { enabled: true, nextRunAt: { lte: now } },
      take: 100,
    }),
  ]);
  let scheduled = 0;
  for (const discovery of discoveries) {
    const pause = pausedUntil.get(stores[discovery.store as Store][0]);
    if (pause) {
      await prisma.externalDiscovery.updateMany({
        where: { id: discovery.id, nextRunAt: { lte: now } },
        data: {
          nextRunAt: new Date(
            pause.getTime() + Math.floor(Math.random() * 60000),
          ),
        },
      });
      continue;
    }
    scheduled += await prisma.$transaction(async (tx) => {
      const claimed = await tx.externalDiscovery.updateMany({
        where: { id: discovery.id, enabled: true, nextRunAt: { lte: now } },
        data: {
          nextRunAt: nextCrawl(discovery.intervalMinutes, now.getTime()),
        },
      });
      if (!claimed.count) return 0;
      await enqueue(
        tx,
        'DISCOVER',
        { discoveryId: discovery.id },
        `discovery:${discovery.id}`,
      );
      return 1;
    });
  }
  for (const source of sources) {
    const pause = pausedUntil.get(stores[source.store as Store][0]);
    if (pause) {
      await prisma.externalSource.updateMany({
        where: { id: source.id, nextRunAt: { lte: now } },
        data: {
          nextRunAt: new Date(
            pause.getTime() + Math.floor(Math.random() * 60000),
          ),
        },
      });
      continue;
    }
    scheduled += await prisma.$transaction(async (tx) => {
      const claimed = await tx.externalSource.updateMany({
        where: { id: source.id, enabled: true, nextRunAt: { lte: now } },
        data: {
          nextRunAt: nextCrawl(source.intervalMinutes, now.getTime()),
        },
      });
      if (!claimed.count) return 0;
      await enqueue(tx, 'SYNC', { sourceId: source.id }, `source:${source.id}`);
      return 1;
    });
  }
  return { scheduled };
}

@Injectable()
export class PipelineScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private logger = new Logger(PipelineScheduler.name);
  onModuleInit() {
    if (process.env.EXTERNAL_SYNC_ENABLED !== 'true') return;
    const tick = async () => {
      if (this.running) return;
      this.running = true;
      try {
        await scheduleDue();
      } catch {
        this.logger.error(
          'Could not schedule external jobs; check database migrations',
        );
      } finally {
        this.running = false;
      }
    };
    this.timer = setInterval(() => {
      void tick();
    }, 60000);
    this.timer.unref();
    void tick();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
