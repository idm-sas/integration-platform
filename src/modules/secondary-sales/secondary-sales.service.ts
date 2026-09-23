import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { SUCCESS_MESSAGE } from '../../common/constants/http-status.constant';
import { JwtPayload } from '../../auth/token.service';

import { SecondarySalesQueryDto } from './dto/secondary-sales-query.dto';
import {
  SecondarySalesInvoiceDto,
  SecondarySalesLineDto,
  SecondarySalesSnapshotResponseDto,
} from './dto/secondary-sales-snapshot.dto';

import { InvoiceHeader } from '../../database/entities/invoice-header.entity';
import { InvoiceLine } from '../../database/entities/invoice-line.entity';
import { EXCLUDED_PRODUCT_GROUPS } from '../../common/constants/product.constant';
import { ALLOWED_DOCTYPE_IDS } from '../../common/constants/organization.constant';

@Injectable()
export class SecondarySalesService {
  private readonly logger = new Logger(SecondarySalesService.name);

  constructor(
    @InjectRepository(InvoiceHeader)
    private readonly headerRepo: Repository<InvoiceHeader>,

    @InjectRepository(InvoiceLine)
    private readonly lineRepo: Repository<InvoiceLine>,
  ) {}

  // ─── Public Entry Point ───────────────────────────────────────────────────

  async getInvoices(
    query: SecondarySalesQueryDto,
    principal: JwtPayload,
  ): Promise<SecondarySalesSnapshotResponseDto> {
    const allowedCats = this.getAllowedCategories(principal.scopes);
    const generatedAt = new Date().toISOString();
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;

    this.logger.log(
      `Loading secondary sales invoices | principal: ${principal.sub} | ` +
      `dateFrom=${query.dateFrom} dateTo=${query.dateTo} | ` +
      `page=${page} limit=${limit}`,
    );

    const qb = this.buildQuery(query);

    qb.orderBy('header.invoiceDate', 'DESC')
      .addOrderBy('header.invoiceNo', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [headers, total] = await qb.getManyAndCount();

    this.logger.log(`Invoices fetched: ${headers.length} / ${total}`);

    // Ambil lines untuk semua header sekaligus (hindari N+1)
    const headerIds = headers.map((h) => h.id);

    const lineQb = this.lineRepo
      .createQueryBuilder('line')
      .innerJoinAndSelect('line.product', 'product');

    if (headerIds.length > 0) {
      lineQb.where('line.invoiceHeaderId IN (:...ids)', {
        ids: headerIds,
      });

      if (EXCLUDED_PRODUCT_GROUPS.length > 0) {
        lineQb.andWhere('product.group2 NOT IN (:...excludedGroups)', {
          excludedGroups: EXCLUDED_PRODUCT_GROUPS,
        });
      }

      // Filter kategori berdasarkan scope token.
      // Asumsi: null = semua kategori, [] = tidak ada akses.
      if (allowedCats !== null) {
        if (allowedCats.length > 0) {
          lineQb
            .innerJoin('product.category', 'category')
            .andWhere('LOWER(category.name) IN (:...cats)', {
              cats: allowedCats.map((cat) => cat.toLowerCase()),
            });
        } else {
          lineQb.andWhere('1 = 0');
        }
      }
    }

    const lines = headerIds.length > 0
      ? await lineQb.getMany()
      : [];

    // Group lines by invoiceHeaderId
    const linesByHeader = new Map<string, InvoiceLine[]>();
    for (const line of lines) {
      const arr = linesByHeader.get(line.invoiceHeaderId) ?? [];
      arr.push(line);
      linesByHeader.set(line.invoiceHeaderId, arr);
    }

    const data = headers.map((h) =>
      this.toInvoiceDto(h, linesByHeader.get(h.id) ?? []),
    );

    return {
      message: SUCCESS_MESSAGE.FETCH_LIST,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        generatedAt,
      },
    };
  }

  // ─── Query Builder ────────────────────────────────────────────────────────

  private buildQuery(
    query: SecondarySalesQueryDto,
  ): SelectQueryBuilder<InvoiceHeader> {
    const qb = this.headerRepo
      .createQueryBuilder('header')
      .innerJoinAndSelect('header.retailer', 'retailer')
      .innerJoinAndSelect('header.salesman', 'salesman')
      .innerJoinAndSelect('header.warehouse', 'warehouse');

    // ── Filter tanggal (mandatory) ────────────────────────────────────────
    qb.andWhere('header.invoiceDate >= :dateFrom', {
      dateFrom: query.dateFrom,
    });
    qb.andWhere('header.invoiceDate <= :dateTo', {
      dateTo: query.dateTo,
    });

    // ── Filter salesman berdasarkan bpGroup ───────────────────────────────
    qb.andWhere('salesman.bpGroup = :bpGroup', {
      bpGroup: 'SALES SIGNIFY',
    });

    // ── Filter retailer ───────────────────────────────────────────────────
    qb.andWhere('header.c_doctype_id NOT IN (:...includeDocType)', {
          includeDocType: ALLOWED_DOCTYPE_IDS,
        })
      .andWhere("retailer.name NOT LIKE '[LA]%'")
      .andWhere("retailer.location NOT LIKE '[LA]%'")
      .andWhere('retailer.arcode IS NOT NULL');

    return qb;
  }

  // ─── Mapper ke DTO ────────────────────────────────────────────────────────

  private toInvoiceDto(
    header: InvoiceHeader,
    lines: InvoiceLine[],
  ): SecondarySalesInvoiceDto {
    return new SecondarySalesInvoiceDto({
      // ── Identitas ──────────────────────────────────────────────────────
      sellerErpId:     header.sellerErpId,
      sellerName:      header.organization,
      orderNo:         header.orderNo,
      invoiceDate:     header.invoiceDate,
      invoiceNo:       header.invoiceNo,
      warehouseErpId:  header.organization ?? null,
      status:          header.status,

      // ── Nilai Invoice ──────────────────────────────────────────────────
      totalGrossValue: Number(header.totalGrossValue),
      totalDiscount:   Number(header.totalDiscount),
      totalNetValue:   Number(header.totalNetValue),
      taxPercent:      Number(header.taxPercent),
      taxValue:        Number(header.taxValue),
      totalValue:      Number(header.totalValue),
      totalQuantity:   lines.reduce(
        (sum, line) => sum + Number(line.invoicedQuantity),
        0,
      ),

      // ── Remark ─────────────────────────────────────────────────────────
      remark:          header.remark,

      // ── Salesman ───────────────────────────────────────────────────────
      esmErpId:        header.salesman?.id   ?? '',
      esmName:         header.salesman?.name ?? '',

      // ── Retailer ───────────────────────────────────────────────────────
      retailerErpId:   header.retailer?.value ?? '',
      retailerName:    header.retailer?.name  ?? '',

      // ── Lines ──────────────────────────────────────────────────────────
      lines:           lines.map((line) => this.toLineDto(line)),
    });
  }

  private toLineDto(line: InvoiceLine): SecondarySalesLineDto {
    return new SecondarySalesLineDto({
      productErpId:     line.product?.code         ?? '',
      productName:      line.product?.name         ?? '',
      sapProductCode:   line.product?.partner_code ?? '',

      grossValue:       Number(line.grossValue),
      netValue:         Number(line.netValue),
      price:            Number(line.price),
      totalValue:       Number(line.netValue),

      discount1Code:    line.discount1Code,
      discount1Percent: Number(line.discount1Percent),

      freeQty:          Number(line.freeQty),
      invoicedQuantity: Number(line.invoicedQuantity),
      uom:              line.uom,
    });
  }

  private getAllowedCategories(scopes: string[]): string[] | null {
    if (scopes.includes('product:read:*')) return null;

    const allowed: string[] = [];
    for (const scope of scopes) {
      const match = scope.match(/^product:read:(.+)$/);
      if (match) allowed.push(match[1].toLowerCase());
    }
    return allowed;
  }
}