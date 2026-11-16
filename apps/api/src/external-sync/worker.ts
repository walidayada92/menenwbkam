import 'reflect-metadata';
import { prisma, Prisma, ExternalJob } from '@menenwbkam/database';
import { claimJob, finishJob, failJob } from './job-queue';
import { runDiscovery } from './discovery';
import { ExternalSyncService } from './external-sync.service';
import { matchListing } from './product-matcher';
import { indexListing } from './search-index';
import { StoreBackoffError, BackoffKind } from './crawl-policy';

function payloadId(payload: Prisma.JsonValue, key: string) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    typeof payload[key] !== 'string'
  )
    throw new Error(`Invalid job payload: ${key}`);
  return payload[key] as string;
}
export async function processJob(
  job: ExternalJob,
  sync: ExternalSyncService,
  signal: AbortSignal,
) {
  const payload = job.payload as Prisma.JsonObject;
  if (job.kind === 'DISCOVER')
    return runDiscovery(
      payloadId(payload, 'discoveryId'),
      signal,
      payload.manual === true,
    );
  if (job.kind === 'SYNC') {
    const id = payloadId(payload, 'sourceId');
    const source = await prisma.externalSource.findUnique({ where: { id } });
    if (!source || (!source.enabled && payload.manual !== true))
      return { skipped: true };
    const run = await sync.run(id);
    const errors = JSON.stringify(run.errors);
    const pause = Array.isArray(run.errors)
      ? run.errors
          .flatMap((error) => {
            if (
              !error ||
              typeof error !== 'object' ||
              Array.isArray(error) ||
              typeof error.retryAt !== 'string'
            )
              return [];
            const retryAt = Date.parse(error.retryAt);
            return Number.isFinite(retryAt)
              ? [
                  {
                    retryAt,
                    kind:
                      typeof error.backoffKind === 'string'
                        ? (error.backoffKind as BackoffKind)
                        : ('COOLDOWN' as BackoffKind),
                    deferred: error.deferred === true,
                  },
                ]
              : [];
          })
          .sort((a, b) => b.retryAt - a.retryAt)[0]
      : undefined;
    if (pause)
      throw new StoreBackoffError(
        'Source paused; inspect run ' + run.id,
        new Date(pause.retryAt),
        pause.kind,
        pause.deferred,
      );
    if (
      run.status === 'FAILED' ||
      /HTTP 5\d\d|timeout|timed out|aborted|fetch failed|blocked\/rate limited|lease expired/i.test(
        errors,
      )
    )
      throw new Error(
        `Source sync ${run.status}; inspect run ${run.id} for failed pages`,
      );
    return {
      runId: run.id,
      status: run.status,
      checked: run.checked,
      changed: run.changed,
    };
  }
  if (job.kind === 'MATCH')
    return matchListing(payloadId(payload, 'listingId'));
  if (job.kind === 'INDEX')
    return indexListing(payloadId(payload, 'listingId'));
  throw new Error('Unknown job kind');
}
export async function runWorker(
  options: { kinds?: string[]; drain?: boolean; once?: boolean } = {},
) {
  const sync = new ExternalSyncService();
  let stopping = false;
  const controller = new AbortController();
  const stop = () => {
    stopping = true;
    controller.abort();
    sync.onModuleDestroy();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  console.log('External pipeline worker started (PostgreSQL queue)');
  try {
    while (!stopping) {
      let job: ExternalJob | null = null;
      try {
        job = await claimJob(options.kinds);
        if (!job) {
          if (options.drain) break;
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        const signal = AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(900000),
        ]);
        const result = await processJob(job, sync, signal);
        await finishJob(job, result as Prisma.InputJsonValue);
        console.log(
          JSON.stringify({
            jobId: job.id,
            kind: job.kind,
            status: 'SUCCEEDED',
          }),
        );
      } catch (error) {
        if (job) await failJob(job, error);
        console.error(
          JSON.stringify({
            jobId: job?.id,
            error: error instanceof Error ? error.message : 'Worker error',
          }),
        );
        if (!job) await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      if (options.once) break;
    }
  } finally {
    await prisma.$disconnect();
  }
}
if (require.main === module) {
  const kinds = process.argv
    .find((arg) => arg.startsWith('--kinds='))
    ?.slice(8)
    .split(',');
  if (
    kinds?.some(
      (kind) => !['DISCOVER', 'SYNC', 'MATCH', 'INDEX'].includes(kind),
    )
  )
    throw new Error('Invalid worker job kind');
  void runWorker({
    kinds,
    drain: process.argv.includes('--drain'),
    once: process.argv.includes('--once'),
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Worker failed');
    process.exitCode = 1;
  });
}
