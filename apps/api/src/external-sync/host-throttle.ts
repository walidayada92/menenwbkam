import { prisma, ExternalHostThrottle } from '@menenwbkam/database';
import { setTimeout } from 'node:timers/promises';
import {
  BackoffKind,
  cooldownDeadline,
  crawlSettings,
  StoreBackoffError,
} from './crawl-policy';
export async function throttleHost(
  host: string,
  delayMs: number,
  signal: AbortSignal,
) {
  const key = host.replace(/^www\./, '');
  const limits = crawlSettings();
  const reserved = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "ExternalHostThrottle" (host, "nextAllowedAt", "delayMs") VALUES (${key}, NOW(), ${delayMs}) ON CONFLICT (host) DO NOTHING`;
    const rows = await tx.$queryRaw<
      ExternalHostThrottle[]
    >`SELECT * FROM "ExternalHostThrottle" WHERE host=${key} FOR UPDATE`;
    const row = rows[0],
      now = new Date();
    if (row.cooldownUntil && row.cooldownUntil > now)
      return {
        error: new StoreBackoffError(
          'Store is in a shared cooldown',
          row.cooldownUntil,
          'COOLDOWN',
          true,
        ),
      };
    const hourStartedAt =
      now.getTime() - row.hourStartedAt.getTime() >= 3600000
        ? now
        : row.hourStartedAt;
    const dayStartedAt =
      now.getTime() - row.dayStartedAt.getTime() >= 86400000
        ? now
        : row.dayStartedAt;
    const hourRequests = hourStartedAt === now ? 0 : row.hourRequests;
    const dayRequests = dayStartedAt === now ? 0 : row.dayRequests;
    if (
      hourRequests >= limits.hourlyBudget ||
      dayRequests >= limits.dailyBudget
    ) {
      const retryAt = new Date(
        Math.max(
          hourRequests >= limits.hourlyBudget
            ? hourStartedAt.getTime() + 3600000
            : 0,
          dayRequests >= limits.dailyBudget
            ? dayStartedAt.getTime() + 86400000
            : 0,
        ),
      );
      return {
        error: new StoreBackoffError(
          'Store request budget reached',
          retryAt,
          'BUDGET',
          true,
        ),
      };
    }
    const spacing = Math.max(delayMs, row.delayMs, limits.minDelayMs);
    const allowedAt = new Date(
      Math.max(now.getTime(), row.nextAllowedAt.getTime()),
    );
    await tx.externalHostThrottle.update({
      where: { host: key },
      data: {
        delayMs: spacing,
        nextAllowedAt: new Date(allowedAt.getTime() + spacing),
        hourStartedAt,
        dayStartedAt,
        hourRequests: hourRequests + 1,
        dayRequests: dayRequests + 1,
      },
    });
    return { allowedAt };
  });
  if (reserved.error) throw reserved.error;
  const wait = reserved.allowedAt!.getTime() - Date.now();
  if (wait > 0) await setTimeout(wait, undefined, { signal });
  signal.throwIfAborted();
  // A different worker may have received a block while this request waited.
  const latest = await prisma.externalHostThrottle.findUnique({
    where: { host: key },
    select: { cooldownUntil: true },
  });
  if (latest?.cooldownUntil && latest.cooldownUntil.getTime() > Date.now())
    throw new StoreBackoffError(
      'Store is in a shared cooldown',
      latest.cooldownUntil,
      'COOLDOWN',
      true,
    );
}
export async function pauseHost(
  host: string,
  kind: BackoffKind,
  header: string | null,
) {
  const key = host.replace(/^www\./, '');
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "ExternalHostThrottle" (host, "nextAllowedAt", "delayMs") VALUES (${key}, NOW(), 5000) ON CONFLICT (host) DO NOTHING`;
    const rows = await tx.$queryRaw<
      ExternalHostThrottle[]
    >`SELECT * FROM "ExternalHostThrottle" WHERE host=${key} FOR UPDATE`;
    const row = rows[0],
      now = new Date();
    const blockCount =
      row.lastBlockedAt &&
      now.getTime() - row.lastBlockedAt.getTime() < 86400000
        ? row.blockCount + 1
        : 1;
    const cooldownUntil = new Date(
      Math.max(
        cooldownDeadline(kind, blockCount, header).getTime(),
        row.cooldownUntil?.getTime() || 0,
      ),
    );
    await tx.externalHostThrottle.update({
      where: { host: key },
      data: {
        cooldownUntil,
        lastBlockedAt: now,
        lastBlockReason: kind,
        blockCount,
        nextAllowedAt: new Date(
          Math.max(row.nextAllowedAt.getTime(), cooldownUntil.getTime()),
        ),
      },
    });
    return cooldownUntil;
  });
}
