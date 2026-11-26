import { prisma, Prisma, ExternalJob } from '@menenwbkam/database';
import { randomUUID } from 'node:crypto';
import { StoreBackoffError } from './crawl-policy';
export type JobKind = 'DISCOVER' | 'SYNC' | 'MATCH' | 'INDEX';
export async function enqueue(
  tx: Prisma.TransactionClient,
  kind: JobKind,
  payload: Prisma.InputJsonObject,
  dedupeKey?: string,
) {
  const data = { kind, payload, ...(dedupeKey ? { dedupeKey } : {}) };
  if (!dedupeKey) return tx.externalJob.create({ data });
  const rows = await tx.$queryRaw<
    ExternalJob[]
  >`INSERT INTO "ExternalJob" (id, kind, payload, "dedupeKey", "updatedAt")
    VALUES (${randomUUID()}, ${kind}, ${JSON.stringify(payload)}::jsonb, ${dedupeKey}, NOW())
    ON CONFLICT ("dedupeKey") DO UPDATE SET "dedupeKey"=EXCLUDED."dedupeKey" RETURNING *`;
  return rows[0];
}
export async function queueJob(
  kind: JobKind,
  payload: Prisma.InputJsonObject,
  dedupeKey?: string,
) {
  return prisma.$transaction((tx) => enqueue(tx, kind, payload, dedupeKey));
}
export async function claimJob(
  kinds: string[] = ['DISCOVER', 'SYNC', 'MATCH', 'INDEX'],
) {
  // Expired final attempts must not remain RUNNING forever.
  await prisma.$executeRaw`UPDATE "ExternalJob" SET status='FAILED', "dedupeKey"=NULL, "leaseToken"=NULL,
    "lockedUntil"=NULL, "finishedAt"=NOW(), "updatedAt"=NOW(), "lastError"='Worker lease expired after final attempt'
    WHERE status='RUNNING' AND "lockedUntil" < NOW() AND attempts >= "maxAttempts"`;
  const token = randomUUID();
  const jobs = await prisma.$queryRaw<ExternalJob[]>`
    WITH candidate AS (
      SELECT id FROM "ExternalJob" WHERE kind IN (${Prisma.join(kinds)}) AND attempts < "maxAttempts"
      AND ((status='WAITING' AND "availableAt" <= NOW()) OR (status='RUNNING' AND "lockedUntil" < NOW()))
      ORDER BY CASE kind WHEN 'INDEX' THEN 0 WHEN 'MATCH' THEN 1 WHEN 'DISCOVER' THEN 2 ELSE 3 END,
        "availableAt", "createdAt", id FOR UPDATE SKIP LOCKED LIMIT 1
    ) UPDATE "ExternalJob" j SET status='RUNNING', attempts=j.attempts+1, "leaseToken"=${token},
      "lockedUntil"=NOW()+INTERVAL '30 minutes', "updatedAt"=NOW()
      FROM candidate WHERE j.id=candidate.id RETURNING j.*`;
  return jobs[0] || null;
}
export async function finishJob(
  job: ExternalJob,
  result: Prisma.InputJsonValue,
) {
  return prisma.externalJob.updateMany({
    where: { id: job.id, leaseToken: job.leaseToken, status: 'RUNNING' },
    data: {
      status: 'SUCCEEDED',
      result,
      finishedAt: new Date(),
      lockedUntil: null,
      leaseToken: null,
      dedupeKey: null,
      lastError: null,
    },
  });
}
export async function failJob(job: ExternalJob, error: unknown) {
  const deferred = error instanceof StoreBackoffError && error.deferred;
  const final = !deferred && job.attempts >= job.maxAttempts;
  return prisma.externalJob.updateMany({
    where: { id: job.id, leaseToken: job.leaseToken, status: 'RUNNING' },
    data: {
      status: final ? 'FAILED' : 'WAITING',
      ...(deferred ? { attempts: Math.max(0, job.attempts - 1) } : {}),
      lastError: (error instanceof Error ? error.message : 'Job failed').slice(
        0,
        2000,
      ),
      lockedUntil: null,
      leaseToken: null,
      ...(final ? { dedupeKey: null, finishedAt: new Date() } : {}),
      availableAt: new Date(
        Math.max(
          Date.now() + Math.min(3600, 60 * 2 ** (job.attempts - 1)) * 1000,
          error instanceof StoreBackoffError ? error.retryAt.getTime() : 0,
        ) + Math.floor(Math.random() * 30000),
      ),
    },
  });
}
