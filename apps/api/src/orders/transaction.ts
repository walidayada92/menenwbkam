import { ConflictException } from '@nestjs/common';
import { prisma, Prisma } from '@menenwbkam/database';
import { isTransactionConflict } from '../billing/entitlements';
export async function operationTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let i = 0; i < 3; i++)
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      });
    } catch (error) {
      if (isTransactionConflict(error)) {
        if (i < 2) continue;
        throw new ConflictException('Concurrent operation; please retry');
      }
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException('This operation has already been recorded');
      throw error;
    }
  throw new ConflictException('Please retry');
}
