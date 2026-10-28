import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { IdempiereService } from '../idempiere.service';
import { BaseSyncService } from './base-sync.service';
import { SyncResult } from '../interfaces/sync-result.interface';
import {
  IdempiereCBPLocationRecord,
  IdempiereRetailerRecord,
  IdempiereRetailerRulesRecord,
} from '../interfaces/idempiere-response.interface';
import { Retailer } from '../../database/entities/retailers.entity';
import { RetailerRules } from '../../database/entities/retailer-rules.entity';
import { ProductCategory } from '../../database/entities/product-category.entity';
import { Salesman } from '../../database/entities/salesman.entity';

@Injectable()
export class RetailersSyncService extends BaseSyncService {
  protected readonly logger = new Logger(RetailersSyncService.name);

  constructor(
    @InjectRepository(Retailer)
    private readonly retailerRepo: Repository<Retailer>,

    @InjectRepository(RetailerRules)
    private readonly retailerRuleRepo: Repository<RetailerRules>,

    @InjectRepository(Salesman)
    private readonly salesmanRepo: Repository<Salesman>,

    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,

    private readonly idempiereService: IdempiereService,
  ) {
    super();
  }

  // ─── Sync Master Retailer / Vendor ────────────────────────────

  async syncRetailers(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = this.createResult('Retailer', strategy);

    try {
      this.validateCheckpoint(strategy, since);

      const records = await this.loadRetailersForSync(
        strategy,
        since,
      );

      result.total = records.length;

      this.logger.log(
        `Syncing ${records.length} retailers/vendors (${strategy})...`,
      );

      for (const record of records) {
        try {
          await this.syncRetailerLocations(record);
        } catch (err: unknown) {
          result.failed++;

          this.logger.error(
            `Failed retailer/vendor id=${record.id}: ` +
              this.getSyncErrorMessage(err),
            err instanceof Error ? err.stack : undefined,
          );
        }
      }

      if (result.failed > 0) {
        result.error =
          `${result.failed} retailer/vendor gagal disinkronkan.`;
      }
    } catch (err: unknown) {
      result.error = this.getSyncErrorMessage(err);

      this.logger.error(
        `Retailer/vendor sync error: ${result.error}`,
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      result.durationMs = Date.now() - startTime;
      this.logResult(result);
    }

    return result;
  }

  // ─── Load Partner dan Perubahan Lokasi ───────────────────────

  private async loadRetailersForSync(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<IdempiereRetailerRecord[]> {
    const records =
      strategy === 'full'
        ? await this.idempiereService.getAllRetailers()
        : await this.idempiereService.getUpdatedRetailers(since!);

    const byId = new Map<number, IdempiereRetailerRecord>(
      records.map((record) => [Number(record.id), record]),
    );

    const refreshIds = new Set<number>();

    if (strategy === 'full') {
      // Full sync pertama mengambil partner aktif.
      // Partner existing diambil ulang dengan lokasi aktif/nonaktif
      // agar status lokasi lama tetap dapat diperbarui.
      const existingPartners = await this.retailerRepo.find({
        select: {
          idempiereId: true,
        },
      });

      for (const partner of existingPartners) {
        refreshIds.add(Number(partner.idempiereId));
      }
    } else {
      const changedLocations =
      await this.idempiereService.getUpdatedRetailerLocations(since!);

      // Setiap lokasi yang berubah memicu pengambilan ulang BP,
      // termasuk lokasi nonaktif.
      for (const location of changedLocations) {
        const partnerId = Number(location.C_BPartner_ID?.id);

        if (!Number.isSafeInteger(partnerId) || partnerId <= 0) {
          throw new Error(
            `C_BPartner_ID tidak valid pada lokasi ${location.id}.`,
          );
        }

        refreshIds.add(partnerId);
      }

      this.logger.log(
        `Retailer incremental | since=${since!.toISOString()} | ` +
          `changedBP=${records.length} | ` +
          `changedLocations=${changedLocations.length} | ` +
          `refreshBP=${refreshIds.size}`,
      );
    }

    if (refreshIds.size > 0) {
      const refreshed =
        await this.idempiereService.getRetailersByIds(
          [...refreshIds],
        );

      const returnedIds = new Set(
        refreshed.map((record) => Number(record.id)),
      );

      const missingIds = [...refreshIds].filter(
        (id) => !returnedIds.has(id),
      );

      if (missingIds.length > 0) {
        throw new Error(
          `Partner tidak dikembalikan API: ${missingIds.join(', ')}. ` +
            'Periksa filter IsEmployee, akses API, atau data sumber.',
        );
      }

      for (const record of refreshed) {
        byId.set(Number(record.id), record);
      }
    }

    return [...byId.values()];
  }

  // ─── Pemilihan Lokasi ────────────────────────────────────────

  private selectRetailerLocation(
    locations: IdempiereCBPLocationRecord[],
    existing: Retailer | null,
  ): IdempiereCBPLocationRecord | undefined {
    // Jika sudah terikat ke ID lokasi, jangan pindah ke lokasi lain.
    // Status nonaktif tetap disimpan untuk lokasi ini.
    if (existing?.locationIdempiereId != null) {
      const selected = locations.find(
        (location) =>
          Number(location.id) ===
          Number(existing.locationIdempiereId),
      );

      if (!selected) {
        throw new Error(
          `Lokasi tersimpan ${existing.locationIdempiereId} ` +
            'tidak ditemukan dalam respons API.',
        );
      }

      return selected;
    }

    // Cocokkan data existing sebelum locationIdempiereId ditambahkan.
    if (existing && (existing.location || existing.arcode)) {
      const candidates = locations.filter((location) => {
        const matchesName =
          !existing.location ||
          location.Name === existing.location;

        const matchesArcode =
          !existing.arcode ||
          location.ExternalReference === existing.arcode;

        return matchesName && matchesArcode;
      });

      if (candidates.length !== 1) {
        throw new Error(
          'Lokasi existing belum dapat dicocokkan secara unik. ' +
            'Isi locationIdempiereId berdasarkan lokasi yang benar.',
        );
      }

      return candidates[0];
    }

    // Pertama kali: pilih hanya lokasi aktif.
    return locations
      .filter((location) => this.toBoolean(location.IsActive))
      .sort((a, b) => Number(a.id) - Number(b.id))[0];
  }

  // ─── Mapping Lokasi ──────────────────────────────────────────

  private mapRetailerLocation(
    location?: IdempiereCBPLocationRecord,
  ): Partial<Retailer> {
    if (!location) {
      // Tetap simpan master partner/vendor tanpa lokasi aktif.
      // String kosong digunakan karena location masih NOT NULL.
      return {
        locationIdempiereId: null,
        isLocationActive: false,

        location: '',
        address: '',
        marketname: '',
        city: '',
        subcity: '',
        country: '',
        postal: '',
        arcode: '',

        isShipTo: false,
        isBillTo: false,
        isMainArcode: false,
      };
    }

    const locationId = Number(location.id);

    if (
      !Number.isSafeInteger(locationId) ||
      locationId <= 0
    ) {
      throw new Error('ID C_BPartner_Location tidak valid.');
    }

    const address = location.C_Location_ID;

    // Jangan menimpa alamat dengan string kosong jika API hanya
    // mengembalikan reference { id, identifier }.
    const hasAddressDetails =
      address != null &&
      ['Address2', 'Address3', 'Address4', 'City', 'Postal'].some(
        (field) =>
          Object.prototype.hasOwnProperty.call(address, field),
      );

    if (!hasAddressDetails) {
      throw new Error(
        `Detail C_Location_ID untuk lokasi ${locationId} ` +
          'belum tersedia. Lengkapi pengambilan alamat dari API.',
      );
    }

    return {
      locationIdempiereId: locationId,
      isLocationActive: this.toBoolean(location.IsActive),

      location: location.Name ?? '',
      address: address?.Address2 ?? '',
      marketname: address?.Address3 ?? '',
      city: address?.City ?? '',
      subcity: address?.Address4 ?? '',
      country: address?.C_Country_ID?.identifier ?? '',
      postal: address?.Postal ?? '',
      arcode: location.ExternalReference ?? '',

      isShipTo: this.toBoolean(location.IsShipTo),
      isBillTo: this.toBoolean(location.IsBillTo),
      isMainArcode: this.toBoolean(location.IsMainARCode),
    };
  }

  // ─── Sync Retailer Rules ─────────────────────────────────────

  async syncRetailerRules(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = this.createResult('RetailerRules', strategy);

    try {
      this.validateCheckpoint(strategy, since);

      const records: IdempiereRetailerRulesRecord[] =
        strategy === 'full'
          ? await this.idempiereService.getAllRetailerRules()
          : await this.idempiereService.getUpdatedRetailerRules(
              since!,
            );

      result.total = records.length;

      this.logger.log(
        `Syncing ${records.length} retailer rules (${strategy})...`,
      );

      for (const record of records) {
        try {
          const retailerIdempiereId = Number(
            record.C_BPartner_ID?.id,
          );

          const salesmanIdempiereId = Number(
            record.SalesRep_ID?.C_BPartner_ID?.id,
          );

          const categoryIdempiereId = Number(
            record.M_Product_Category_ID?.id,
          );

          if (
            !Number.isSafeInteger(retailerIdempiereId) ||
            retailerIdempiereId <= 0
          ) {
            throw new Error('Retailer ID tidak valid.');
          }

          if (
            !Number.isSafeInteger(salesmanIdempiereId) ||
            salesmanIdempiereId <= 0
          ) {
            throw new Error('Salesman ID tidak valid.');
          }

          if (
            !Number.isSafeInteger(categoryIdempiereId) ||
            categoryIdempiereId <= 0
          ) {
            throw new Error('Category ID tidak valid.');
          }

          const [retailer, salesman, category] = await Promise.all([
            (async () => {
              const mainRetailer = await this.retailerRepo.findOne({
                where: {
                  idempiereId: retailerIdempiereId,
                  isMainArcode: true,
                },
                order: { id: 'ASC' },
              });

              if (mainRetailer) {
                return mainRetailer;
              }

              return this.retailerRepo.findOne({
                where: {
                  idempiereId: retailerIdempiereId,
                },
                order: { id: 'ASC' },
              });
            })(),

            this.salesmanRepo.findOne({
              where: {
                idempiereId: salesmanIdempiereId,
              },
            }),

            this.categoryRepo.findOne({
              where: {
                idempiereId: categoryIdempiereId,
              },
            }),
          ]);

          if (!retailer) {
            throw new Error(
              `Retailer idempiereId=${retailerIdempiereId} ` +
                'belum tersedia.',
            );
          }

          if (!salesman) {
            throw new Error(
              `Salesman idempiereId=${salesmanIdempiereId} ` +
                'belum tersedia.',
            );
          }

          if (!category) {
            throw new Error(
              `Category idempiereId=${categoryIdempiereId} ` +
                'belum tersedia.',
            );
          }

          const creditLimit = Number(record.SO_CreditLimit ?? 0);

          if (!Number.isFinite(creditLimit)) {
            throw new Error('SO_CreditLimit tidak valid.');
          }

          const existing = await this.retailerRuleRepo.findOne({
            where: {
              idempiereId: record.id,
            },
          });

          const data: Partial<RetailerRules> = {
            idempiereId: record.id,
            orgTrx: record.AD_OrgTrx_ID?.identifier ?? '',
            retailerId: retailer.id,
            salesmanId: salesman.id,
            creditLimit,
            categoryId: category.id,
            paymentTerm: record.C_PaymentTerm_ID?.identifier ?? '',
            isActive: this.toBoolean(record.IsActive),
          };

          if (!existing) {
            await this.retailerRuleRepo.save(
              this.retailerRuleRepo.create({
                ...data,
                syncedAt: new Date(),
              }),
            );

            result.created++;
            continue;
          }

          // Bandingkan field bisnis, bukan updatedAt lokal.
          const hasChange =
            existing.orgTrx !== data.orgTrx ||
            existing.retailerId !== data.retailerId ||
            existing.salesmanId !== data.salesmanId ||
            Number(existing.creditLimit) !== creditLimit ||
            existing.categoryId !== data.categoryId ||
            existing.paymentTerm !== data.paymentTerm ||
            existing.isActive !== data.isActive;

          if (hasChange) {
            await this.retailerRuleRepo.update(existing.id, {
              ...data,
              syncedAt: new Date(),
            });

            result.updated++;
          } else {
            await this.retailerRuleRepo.update(existing.id, {
              syncedAt: new Date(),
            });

            result.skipped++;
          }
        } catch (err: unknown) {
          result.failed++;

          this.logger.error(
            `Failed retailer rule id=${record.id}: ` +
              this.getSyncErrorMessage(err),
            err instanceof Error ? err.stack : undefined,
          );
        }
      }

      if (result.failed > 0) {
        result.error =
          `${result.failed} retailer rules gagal disinkronkan.`;
      }
    } catch (err: unknown) {
      result.error = this.getSyncErrorMessage(err);

      this.logger.error(
        `RetailerRules sync error: ${result.error}`,
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      result.durationMs = Date.now() - startTime;
      this.logResult(result);
    }

    return result;
  }

  // ─── Helpers ────────────────────────────────────────────────

  private validateCheckpoint(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): void {
    if (
      strategy === 'incremental' &&
      (!(since instanceof Date) || Number.isNaN(since.getTime()))
    ) {
      throw new Error('Checkpoint incremental tidak valid.');
    }
  }

  private getSyncErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private async syncRetailerLocations(
    record: IdempiereRetailerRecord,
  ): Promise<void> {
    const idempiereId = Number(record.id);
    const value = record.Value?.trim();
    const name = record.Name?.trim();

    if (!Number.isSafeInteger(idempiereId) || idempiereId <= 0) {
      throw new Error('ID business partner tidak valid.');
    }

    if (!value || !name) {
      throw new Error('Value dan Name business partner wajib tersedia.');
    }

    const locations = record.C_BPartner_Location;

    if (!Array.isArray(locations)) {
      throw new Error('Expand C_BPartner_Location tidak tersedia.');
    }

    // Validasi sebelum menulis data.
    const mappedLocations = locations.map((location) =>
      this.mapRetailerLocation(location),
    );

    const locationIds = mappedLocations.map(
      (location) => location.locationIdempiereId,
    );

    if (new Set(locationIds).size !== locationIds.length) {
      throw new Error(`API mengembalikan ID lokasi duplikat untuk BP ${value}.`);
    }

    await this.retailerRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Retailer);
      const existingRows = await repo.find({
        where: { idempiereId },
      });

      const byLocation = new Map<number, Retailer>();

      for (const existing of existingRows) {
        let locationId = existing.locationIdempiereId;

        // Pertahankan UUID lama agar relasi yang sudah ada tidak terputus.
        if (locationId == null) {
          const candidates = locations.filter((location) => {
            const hasIdentity = Boolean(existing.location || existing.arcode);

            return (
              hasIdentity &&
              (!existing.location || location.Name === existing.location) &&
              (!existing.arcode ||
                location.ExternalReference === existing.arcode)
            );
          });

          if (candidates.length !== 1) {
            throw new Error(
              `Lokasi baris lama BP ${value} belum bisa dicocokkan. ` +
                `Isi locationIdempiereId untuk retailer ${existing.id}.`,
            );
          }

          locationId = Number(candidates[0].id);
        }

        const key = Number(locationId);

        if (byLocation.has(key)) {
          throw new Error(`Duplikasi retailer BP ${value}, lokasi ${key}.`);
        }

        byLocation.set(key, existing);
      }

      for (const locationData of mappedLocations) {
        const locationId = Number(locationData.locationIdempiereId);
        const existing = byLocation.get(locationId);

        const data: Partial<Retailer> = {
          idempiereId,
          value,
          name,
          name2: record.Name2 ?? '',
          bpGroup: record.C_BP_Group_ID?.identifier ?? '',
          isCustomer: this.toBoolean(record.IsCustomer),
          isVendor: this.toBoolean(record.IsVendor),
          isActive: this.toBoolean(record.IsActive),
          isSyncToIntegration: this.toBoolean(record.IsSyncToIntegration),
          isBPReplacement: this.toBoolean(record.IsBPReplacement),
          ...locationData,
          syncedAt: new Date(),
        };

        if (existing) {
          await repo.update(existing.id, data);
        } else {
          await repo.save(repo.create(data));
        }
      }
    });
  }
}