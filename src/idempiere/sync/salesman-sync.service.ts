import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempiereService } from '../idempiere.service';
import { Salesman } from '../../database/entities/salesman.entity';
import { IdempiereSalesmanRecord } from '../interfaces/idempiere-response.interface';
import { SyncResult } from '../interfaces/sync-result.interface';
import { BaseSyncService } from './base-sync.service';

@Injectable()
export class SalesmanSyncService extends BaseSyncService {
  protected readonly logger = new Logger(SalesmanSyncService.name);

  constructor(
    @InjectRepository(Salesman)
    private readonly salesmanRepo: Repository<Salesman>,
    private readonly idempiereService: IdempiereService,
  ) {
    super();
  }

  // ─── Public: dipanggil dari SyncOrchestratorService ──────────────────────────

  async syncSalesmen(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = this.createResult('Salesman', strategy);

    try {
      const records: IdempiereSalesmanRecord[] =
        strategy === 'full'
          ? await this.idempiereService.getAllSalesmen()
          : await this.idempiereService.getUpdatedSalesmen(since!);

      result.total = records.length;
      this.logger.log(`Syncing ${records.length} salesmen (${strategy})...`);

      for (const record of records) {
        try {
          const existing = await this.salesmanRepo.findOne({
            where: { idempiereId: record.id },
          });

          const adUser = record.AD_User?.[0];

          const data: Partial<Salesman> = {
            idempiereId: record.id,
            value: record.Value || '',
            name: record.Name || '',
            name2: record.Name2 || null,
            email: adUser?.EMail || null,
            phone: adUser?.Phone || null,
            position: adUser?.C_Job_ID?.identifier || null,
            positionCodeLevel: 60, // default value, karena iDempiere tidak menyediakan level posisi
            bpGroup: record.C_BP_Group_ID?.identifier || null,
            isActive: this.toBoolean(record.IsActive),
            syncedAt: new Date(),
          };

          if (existing) {
            const hasChange =
              existing.name              !== data.name              ||
              existing.name2             !== data.name2             ||
              existing.email             !== data.email             ||
              existing.phone             !== data.phone             ||
              existing.position          !== data.position          ||
              existing.bpGroup           !== data.bpGroup           ||
              existing.isActive          !== data.isActive;

            if (hasChange) {
              await this.salesmanRepo.update(existing.id, data);
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            await this.salesmanRepo.save(data);
            result.created++;
          }
        } catch (err) {
          this.logger.error(`Failed salesman id=${record.id}: ${err.message}`);
          result.failed++;
        }
      }
    } catch (err) {
      result.error = err.message;
      this.logger.error('Salesman sync error', err.message);
    }

    result.durationMs = Date.now() - startTime;
    this.logResult(result);
    return result;
  }
}
