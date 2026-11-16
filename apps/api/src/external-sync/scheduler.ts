import 'reflect-metadata';
import { setTimeout } from 'node:timers/promises';
import { prisma } from '@menenwbkam/database';
import { scheduleDue } from './pipeline-scheduler';
async function main() {
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());
  console.log('External discovery/sync scheduler started (60 second polling)');
  try {
    while (!controller.signal.aborted) {
      try {
        console.log(JSON.stringify(await scheduleDue()));
      } catch {
        console.error('Scheduling failed; retrying next tick');
      }
      try {
        await setTimeout(60000, undefined, { signal: controller.signal });
      } catch {
        break;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}
if (require.main === module)
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Scheduler failed');
    process.exitCode = 1;
  });
