import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { IdempiereService } from '../idempiere.service';
import { SyncResult } from '../interfaces/sync-result.interface';
import { BaseSyncService } from './base-sync.service';

import {
  IdempiereSecondarySalesRecord,
} from '../interfaces/idempiere-response.interface';

import { InvoiceHeader } from '../../database/entities/invoice-header.entity';
import { InvoiceLine } from '../../database/entities/invoice-line.entity';
import { Product } from '../../database/entities/product.entity';
import { Retailer } from '../../database/entities/retailers.entity';
import { Salesman } from '../../database/entities/salesman.entity';
import { Warehouse } from '../../database/entities/warehouse.entity';
import { 
  FULL_SYNC_DATE_FROM, 
  FULL_SYNC_DATE_TO,
  BATCH_IN_SIZE,
  BATCH_SAVE,
  TAX_CHANGE_DATE,
  getDivisor,
  getTaxRate,
  round2
} from 'src/common/constants/organization.constant';

@Injectable()
export class SecondarySalesSyncService extends BaseSyncService {
  protected readonly logger = new Logger(SecondarySalesSyncService.name);

  constructor(
    @InjectRepository(InvoiceHeader)
    private readonly headerRepo: Repository<InvoiceHeader>,

    @InjectRepository(InvoiceLine)
    private readonly lineRepo: Repository<InvoiceLine>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Retailer)
    private readonly retailerRepo: Repository<Retailer>,

    @InjectRepository(Salesman)
    private readonly salesmanRepo: Repository<Salesman>,

    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,

    private readonly idempiereService: IdempiereService,
  ) {
    super();
  }

  // ─── Public Entry Point ───────────────────────────────────────────────────

  async syncSecondarySales(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = this.createResult('InventoryStock', strategy);

    try {
      const records: IdempiereSecondarySalesRecord[] =
      strategy === 'full'
        ? await this.idempiereService.getAllSecondarySales(
            FULL_SYNC_DATE_FROM,
            FULL_SYNC_DATE_TO,
          )
        : await this.idempiereService.getUpdatedSecondarySales(since!);

      this.logger.log(
        `Fetched ${records.length} records ` +
          `| from=${FULL_SYNC_DATE_FROM} ` +
          `| to=${FULL_SYNC_DATE_TO}`,
      );

      if (records.length === 0) {
        this.logger.warn(
          'Tidak ada record sumber. Tidak ada perubahan stok lokal.',
        );

        return result;
      }

      result.total = records.length;

      // ── Step 2: Kumpulkan semua ID yang dibutuhkan ────────────────────────
      const allProductIdempiereIds = [...new Set(
        records
          .flatMap((inv) => inv.C_InvoiceLine ?? [])
          .filter((line) => !line.IsDescription && line.M_Product_ID?.id != null)
          .map((line) => Number(line.M_Product_ID!.id)),
      )];

      // Retailer: dari C_BPartner_ID.Value
      const allRetailerValues = [...new Set(
        records
          .map((inv) => inv.C_BPartner_ID?.Value)
          .filter((v): v is string => !!v),
      )];

      // Salesman: dari SalesRep_ID.C_BPartner_ID.id
      const allSalesmanIdempiereIds = [...new Set(
        records
          .map((inv) => inv.SalesRep_ID?.C_BPartner_ID?.id)
          .filter((id): id is number => id != null)
          .map(Number),
      )];

      // Warehouse: dari C_Order_ID.M_Warehouse_ID.id
      const allWarehouseIdempiereIds = [...new Set(
        records
          .map((inv) => inv.C_Order_ID?.M_Warehouse_ID?.id)
          .filter((id): id is number => id != null)
          .map(Number),
      )];

      this.logger.log(
        `Batch loading — products: ${allProductIdempiereIds.length} | ` +
        `retailers: ${allRetailerValues.length} | ` +
        `salesmen: ${allSalesmanIdempiereIds.length} | ` +
        `warehouses: ${allWarehouseIdempiereIds.length}`,
      );

      // ── Step 3: Batch load semua lookup dari MiddleDB ─────────────────────
      const [productMap, retailerMap, salesmanMap, warehouseMap] = await Promise.all([
        this.batchFindProducts(allProductIdempiereIds),
        this.batchFindRetailers(allRetailerValues),
        this.batchFindSalesmen(allSalesmanIdempiereIds),
        this.batchFindWarehouses(allWarehouseIdempiereIds),
      ]);

      this.logger.log(
        `Loaded — products: ${productMap.size} | retailers: ${retailerMap.size} | ` +
        `salesmen: ${salesmanMap.size} | warehouses: ${warehouseMap.size}`,
      );

      // ── Step 4: Batch load existing headers ───────────────────────────────
      const rawInvoiceNos = records.map((inv) => inv.DocumentNo).filter(Boolean);
      const existingHeaders = rawInvoiceNos.length > 0
        ? await this.headerRepo.find({ where: { invoiceNo: In(rawInvoiceNos) } })
        : [];
      const existingHeaderMap = new Map(existingHeaders.map((h) => [h.invoiceNo, h]));

      this.logger.log(`Found ${existingHeaders.length} existing invoice headers`);

      // ── Step 5: Build insert/update lists ─────────────────────────────────
      const toInsertHeaders: Partial<InvoiceHeader>[] = [];
      const toUpdateHeaders: { id: string; data: Partial<InvoiceHeader> }[] = [];

      for (const raw of records) {
        try {
          const lines = (raw.C_InvoiceLine ?? []).filter(
            (l) => !l.IsDescription && l.M_Product_ID?.id != null,
          );
          const invoiceDate = raw.DateInvoiced?.substring(0, 10) ?? '';
          const divisor     = getDivisor(invoiceDate);
          const taxRate     = getTaxRate(invoiceDate);

          // ── totalGrossValue ──────────────────────────────────────────────
          // ROUND(PriceList * QtyInvoiced, 2) per line
          // PriceList di iDempiere = harga list master (belum diskon, belum PPN)
          const totalGrossValue = round2(
            lines.reduce(
              (sum, line) =>
                sum + round2(Number(line.PriceList) * Number(line.QtyInvoiced)),
              0,
            ),
          );

          // ── totalDiscount ────────────────────────────────────────────────
          // Gross - Net (LineNetAmt = PriceActual × QtyInvoiced)
          const totalDiscount = round2(
            lines.reduce(
              (sum, line) =>
                sum + (
                  round2(Number(line.PriceList) * Number(line.QtyInvoiced)) -
                  round2(Number(line.LineNetAmt))
                ),
              0,
            ),
          );

          // ── totalCashDiscountValue ───────────────────────────────────────
          // Di REST expand tidak tersedia C_Charge_ID di level line.
          // Nilai asli diambil dari subquery c_orderline (cash discount charge).
          // → fallback 0
          const totalCashDiscountValue = 0;

          // ── totalNetValue ────────────────────────────────────────────────
          // Netto sebelum pajak (DPP) = TotalLines
          const totalNetValue = round2(Number(raw.TotalLines || 0));

          // ── taxValue ─────────────────────────────────────────────────────
          // Jika GrandTotal sudah termasuk PPN (IsTaxIncluded = true):
          //   DPP       = GrandTotal / divisor
          //   PPN(tax)  = GrandTotal - DPP
          // Jika GrandTotal belum termasuk PPN:
          //   DPP       = TotalLines
          //   PPN(tax)  = TotalLines × taxRate / 100
          let taxValue: number;
          if (raw.IsTaxIncluded) {
            const dpp = Number(raw.GrandTotal) / divisor;
            taxValue  = round2(Number(raw.GrandTotal) - dpp);
          } else {
            taxValue = round2(Number(raw.TotalLines || 0) * taxRate / 100);
          }

          // ── totalValue ───────────────────────────────────────────────────
          // Total akhir (termasuk PPN) = GrandTotal
          const totalValue = round2(Number(raw.GrandTotal || 0));

          // ── taxPercent ───────────────────────────────────────────────────
          // Persentase PPN (10 atau 11), bukan jumlah pajak
          const taxPercent = taxRate;

          // ── Resolve FK ke MiddleDB ───────────────────────────────────────
          const retailer  = retailerMap.get(raw.C_BPartner_ID?.Value ?? '');
          const salesmanEId = raw.SalesRep_ID?.C_BPartner_ID?.id
            ? Number(raw.SalesRep_ID.C_BPartner_ID.id)
            : null;
          const salesman  = salesmanEId ? salesmanMap.get(salesmanEId) : undefined;
          const warehouseEId = raw.C_Order_ID?.M_Warehouse_ID?.id
            ? Number(raw.C_Order_ID.M_Warehouse_ID.id)
            : null;
          const warehouse = warehouseEId ? warehouseMap.get(warehouseEId) : undefined;

          if (!retailer) {
            this.logger.debug(
              `Retailer value=${raw.C_BPartner_ID?.Value} not in MiddleDB, skipping invoice ${raw.DocumentNo}`,
            );
            result.skipped++;
            continue;
          }

          if (!salesman) {
            this.logger.debug(
              `Salesman idempiereId=${salesmanEId} not in MiddleDB, skipping invoice ${raw.DocumentNo}`,
            );
            result.skipped++;
            continue;
          }

          if (!warehouse) {
            this.logger.debug(
              `Warehouse idempiereId=${warehouseEId} not in MiddleDB, skipping invoice ${raw.DocumentNo}`,
            );
            result.skipped++;
            continue;
          }

          const headerData: Partial<InvoiceHeader> = {
            organization:           raw.AD_Org_ID?.identifier ?? '',
            sellerErpId:            raw.AD_OrgTrx_ID?.identifier ?? '',
            orderNo:                raw.C_Order_ID?.DocumentNo ?? null,
            invoiceDate,
            invoiceNo:              raw.DocumentNo,
            warehouseErpId:         warehouse.id,
            totalGrossValue,
            status:                 raw.DocStatus?.identifier ?? '',
            totalDiscount,
            totalCashDiscountValue,
            totalNetValue,
            taxPercent,
            taxValue,
            totalValue,
            remark:                 raw.Description ?? null,
            retailerErpId:          retailer.id,
            esmId:                  salesman.id,
            issotrx:                raw.IsSOTrx ? 'Y' : 'N',
            c_doctype_id:           raw.C_DocType_ID?.id ?? 0,
          };

          const existing = existingHeaderMap.get(raw.DocumentNo);

          if (existing) {
            const hasChange =
              existing.status                       !== headerData.status                        ||
              Number(existing.totalGrossValue)      !== headerData.totalGrossValue               ||
              Number(existing.totalNetValue)        !== headerData.totalNetValue                 ||
              Number(existing.totalValue)           !== headerData.totalValue;

            if (hasChange) {
              toUpdateHeaders.push({ id: existing.id, data: headerData });
            } else {
              result.skipped++;
            }
          } else {
            toInsertHeaders.push(headerData);
          }
        } catch (err) {
          this.logger.error(`Failed invoice ${raw.DocumentNo}: ${err.message}`);
          result.failed++;
        }
      }

      // ── Step 6: Bulk insert headers ───────────────────────────────────────
      const savedHeaders: InvoiceHeader[] = [];

      for (let i = 0; i < toInsertHeaders.length; i += BATCH_SAVE) {
        const chunk = toInsertHeaders.slice(i, i + BATCH_SAVE);
        const saved = await this.headerRepo.save(chunk);
        savedHeaders.push(...saved);
        this.logger.log(
          `Insert header chunk ${Math.floor(i / BATCH_SAVE) + 1}/${Math.ceil(toInsertHeaders.length / BATCH_SAVE)} ` +
          `(${chunk.length} rows)`,
        );
      }
      result.created = toInsertHeaders.length;

      // ── Step 7: Bulk update headers ───────────────────────────────────────
      for (let i = 0; i < toUpdateHeaders.length; i += BATCH_SAVE) {
        const chunk = toUpdateHeaders.slice(i, i + BATCH_SAVE);
        await Promise.all(chunk.map(({ id, data }) => this.headerRepo.update(id, data)));
        this.logger.log(
          `Update header chunk ${Math.floor(i / BATCH_SAVE) + 1}/${Math.ceil(toUpdateHeaders.length / BATCH_SAVE)} ` +
          `(${chunk.length} rows)`,
        );
      }
      result.updated = toUpdateHeaders.length;

      // ── Step 8: Build invoiceNo → UUID map (untuk sync lines) ─────────────
      const headerIdMap = new Map<string, string>([
        ...savedHeaders.map((h): [string, string] => [h.invoiceNo, h.id]),
        ...toUpdateHeaders.map(({ id, data }): [string, string] => [data.invoiceNo as string, id]),
        ...existingHeaders.map((h): [string, string] => [h.invoiceNo, h.id]),
      ]);

      // ── Step 9: Sync invoice lines ─────────────────────────────────────────
      await this.syncLines(records, headerIdMap, productMap);

    } catch (err) {
      result.error = err.message;
      this.logger.error('Secondary sales sync error', err.message, err.stack);
    }

    result.durationMs = Date.now() - startTime;
    this.logResult(result);
    return result;
  }

  // ─── Sync Lines ───────────────────────────────────────────────────────────

  private async syncLines(
  records: IdempiereSecondarySalesRecord[],
  headerIdMap: Map<string, string>,
  productMap: Map<number, Product>,
  ): Promise<void> {
    // Flatten semua lines dengan reference ke invoiceNo
    const allRawLines = records.flatMap((inv) =>
      (inv.C_InvoiceLine ?? [])
        .filter((line) => !line.IsDescription && line.M_Product_ID?.id != null)
        .map((line) => ({
          ...line,
          _invoiceNo:   inv.DocumentNo,
          _invoiceDate: inv.DateInvoiced,
        })),
    );

    if (allRawLines.length === 0) {
      this.logger.log('No invoice lines to sync');
      return;
    }

    this.logger.log(`Syncing ${allRawLines.length} invoice lines...`);

    // Batch load existing lines berdasarkan invoiceHeaderId
    const headerUuids = [...new Set([...headerIdMap.values()])];
    const existingLines = headerUuids.length > 0
      ? await this.lineRepo
          .createQueryBuilder('line')
          .where('line.invoiceHeaderId IN (:...ids)', { ids: headerUuids })
          .getMany()
      : [];

    // Key: "invoiceHeaderId::productId" untuk deteksi duplikat
    const existingLineMap = new Map(
      existingLines.map((l) => [`${l.invoiceHeaderId}::${l.productId}`, l]),
    );

    const toInsertLines: Partial<InvoiceLine>[] = [];
    const toUpdateLines: { id: string; data: Partial<InvoiceLine> }[] = [];

    for (const line of allRawLines) {
      const headerUuid = headerIdMap.get(line._invoiceNo);
      if (!headerUuid) continue;

      const productEId = Number(line.M_Product_ID!.id);
      const product    = productMap.get(productEId);
      if (!product) continue;

      // ── Hitung nilai (semua number) ───────────────────────────────────────
      const qtyInvoiced  = Number(line.QtyInvoiced  || 0);
      const priceList    = Number(line.PriceList    || 0);
      const priceActual  = Number(line.PriceActual  || 0);
      const lineNetAmt   = Number(line.LineNetAmt   || 0);

      // grossValue: harga list × qty (sebelum diskon & PPN)
      const grossValue = round2(priceList * qtyInvoiced);

      // netValue: LineNetAmt sudah = PriceActual × QtyInvoiced
      const netValue = round2(lineNetAmt);

      // freeQty: kalau PriceActual = 0, maka qty dianggap gratis
      const freeQty = priceActual === 0 ? qtyInvoiced : 0;

      const discount1Percent = Number(line.C_OrderLine_ID?.Discount ?? 0);

      // ── Bangun payload (semua field numerik → number) ─────────────────────
      const lineData: Partial<InvoiceLine> = {
        invoiceHeaderId:  headerUuid,                 // string (uuid)
        productId:        product.id,                 // string (uuid)

        grossValue,                                   // number
        netValue,                                     // number
        price:            priceActual,                // number

        discount1Code:
          line.SAS_DiscountList_ID?.identifier ??
          line.C_OrderLine_ID?.SAS_DiscountList_ID?.identifier ??
          null,

        discount1Percent,                             // number
        freeQty,                                      // number
        invoicedQuantity: qtyInvoiced,                // number

        uom:              line.C_UOM_ID?.identifier ?? '',
        description:      line.Description ?? null,
      };

      const existingKey = `${headerUuid}::${product.id}`;
      const existing    = existingLineMap.get(existingKey);

      if (existing) {
        const hasChange =
          existing.invoicedQuantity !== lineData.invoicedQuantity ||
          existing.price            !== lineData.price            ||
          existing.grossValue       !== lineData.grossValue       ||
          existing.netValue         !== lineData.netValue;

        if (hasChange) {
          toUpdateLines.push({ id: existing.id, data: lineData });
        }
      } else {
        toInsertLines.push(lineData);
      }
    }

    // Bulk insert lines
    for (let i = 0; i < toInsertLines.length; i += BATCH_SAVE) {
      const chunk = toInsertLines.slice(i, i + BATCH_SAVE);
      await this.lineRepo.save(chunk);
      this.logger.log(
        `Insert line chunk ${Math.floor(i / BATCH_SAVE) + 1}/${Math.ceil(toInsertLines.length / BATCH_SAVE)} ` +
        `(${chunk.length} rows)`,
      );
    }

    // Bulk update lines
    if (toUpdateLines.length > 0) {
      for (let i = 0; i < toUpdateLines.length; i += BATCH_SAVE) {
        const chunk = toUpdateLines.slice(i, i + BATCH_SAVE);
        await Promise.all(chunk.map(({ id, data }) => this.lineRepo.update(id, data)));
      }
    }

    this.logger.log(
      `Lines — inserted: ${toInsertLines.length} | updated: ${toUpdateLines.length}`,
    );
  }

  // ─── Batch Load Helpers ───────────────────────────────────────────────────

  private async batchFindProducts(ids: number[]): Promise<Map<number, Product>> {
    const map = new Map<number, Product>();
    for (let i = 0; i < ids.length; i += BATCH_IN_SIZE) {
      const rows = await this.productRepo.find({
        where: { idempiereId: In(ids.slice(i, i + BATCH_IN_SIZE)) },
      });
      rows.forEach((p) => map.set(p.idempiereId, p));
    }
    return map;
  }

  private async batchFindRetailers(values: string[]): Promise<Map<string, Retailer>> {
    const map = new Map<string, Retailer>();
    for (let i = 0; i < values.length; i += BATCH_IN_SIZE) {
      const rows = await this.retailerRepo.find({
        where: { value: In(values.slice(i, i + BATCH_IN_SIZE)) },
      });
      rows.forEach((r) => map.set(r.value, r));
    }
    return map;
  }

  private async batchFindSalesmen(ids: number[]): Promise<Map<number, Salesman>> {
    const map = new Map<number, Salesman>();
    for (let i = 0; i < ids.length; i += BATCH_IN_SIZE) {
      const rows = await this.salesmanRepo.find({
        where: { idempiereId: In(ids.slice(i, i + BATCH_IN_SIZE)) },
      });
      rows.forEach((s) => map.set(s.idempiereId, s));
    }
    return map;
  }

  private async batchFindWarehouses(ids: number[]): Promise<Map<number, Warehouse>> {
    const map = new Map<number, Warehouse>();
    for (let i = 0; i < ids.length; i += BATCH_IN_SIZE) {
      const rows = await this.warehouseRepo.find({
        where: { idempiereId: In(ids.slice(i, i + BATCH_IN_SIZE)) },
      });
      rows.forEach((w) => map.set(w.idempiereId, w));
    }
    return map;
  }
}