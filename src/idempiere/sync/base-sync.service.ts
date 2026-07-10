import { Logger } from '@nestjs/common';
import { SyncResult } from '../interfaces/sync-result.interface';

export abstract class BaseSyncService {
  protected abstract readonly logger: Logger;

  protected toBoolean(value: any): boolean {
    return value === 'true' || value === true;
  }

  protected createResult(
    entity: string,
    strategy: 'full' | 'incremental',
  ): SyncResult {
    return {
      entity,
      strategy,
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      durationMs: 0,
      syncedAt: new Date(),
    };
  }

  protected logResult(result: SyncResult): void {
    this.logger.log(
      `${result.entity} | +${result.created} created | ~${result.updated} updated | =${result.skipped} skipped | ✗${result.failed} failed | ${result.durationMs}ms`,
    );
  }
}
