import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { SUCCESS_MESSAGE } from '../../common/constants/http-status.constant';
import { JwtPayload } from '../../auth/token.service';
import { PrimaryInvoicesQueryDto } from './dto/primary-invoices-query.dto';
import {
  PrimaryInvoicesDto,
  PrimaryInvoiceLineDto,
  PrimaryInvoicesSnapshotResponseDto,
} from './dto/primary-invoices-snapshot.dto';
import { InvoiceHeader } from '../../database/entities/invoice-header.entity';
import { InvoiceLine } from '../../database/entities/invoice-line.entity';
import { EXCLUDED_PRODUCT_GROUPS } from '../../common/constants/product.constant';
import { PRIMARY_DOCTYPE_IDS } from '../../common/constants/doctype.constant';

@Injectable()
export class PrimaryInvoicesService {
  private readonly logger = new Logger(PrimaryInvoicesService.name);

  constructor(
    @InjectRepository(InvoiceHeader)
    private readonly headerRepo: Repository<InvoiceHeader>,
    @InjectRepository(InvoiceLine)
    private readonly lineRepo: Repository<InvoiceLine>,
  ) {}

  // ─── Public Entry Point ───────────────────────────────────────────────────
  async getInvoices(
    query: PrimaryInvoicesQueryDto,
    principal: JwtPayload,
  ): Promise<PrimaryInvoicesSnapshotResponseDto> {
    const allowedCats = this.getAllowedCategories(principal.scopes);
    const generatedAt = new Date().toISOString();
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;

    this.logger.log(
      `Loading primary invoices | principal: ${principal.sub} | ` +
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
    query: PrimaryInvoicesQueryDto,
  ): SelectQueryBuilder<InvoiceHeader> {
    const qb = this.headerRepo
      .createQueryBuilder('header')
      .where('header.invoiceDate >= :dateFrom', {
        dateFrom: query.dateFrom,
      })
      .andWhere('header.invoiceDate <= :dateTo', {
        dateTo: query.dateTo,
      })
      .andWhere('"header"."issotrx" = :isSoTrx', {
        isSoTrx: false,
      });

    if (PRIMARY_DOCTYPE_IDS.length > 0) {
      qb.andWhere('header.c_doctype_id IN (:...primaryDocTypes)', {
        primaryDocTypes: PRIMARY_DOCTYPE_IDS,
      });
    } else {
      qb.andWhere('1 = 0');
    }

    return qb;
  }

  // ─── Mapper ke DTO ────────────────────────────────────────────────────────
  private toInvoiceDto(
    header,
    lines: InvoiceLine[],
  ): PrimaryInvoicesDto {
    return new PrimaryInvoicesDto({
      sellerErpId: header.sellerErpId,
      sellerName: header.organization,
      invoiceDate: header.invoiceDate,
      erpInvoiceNo: header.invoiceNo,
      totalGrossValue: Number(header.totalGrossValue),
      totalDiscount: Number(header.totalDiscount),
      totalNetValue: Number(header.totalNetValue),
      taxValue: Number(header.taxValue),
      totalValue: Number(header.totalValue),
      status: header.status,
      totalQuantity: lines.reduce(
        (sum, line) => sum + Number(line.invoicedQuantity),
        0,
      ),
      lines: lines.map((line) => this.toLineDto(line)),
    });
  }

  private toLineDto(line: InvoiceLine): PrimaryInvoiceLineDto {
    return new PrimaryInvoiceLineDto({
      productErpId:     line.product?.code         ?? '',
      productName:      line.product?.name         ?? '',
      sapProductCode:   line.product?.partner_code ?? '',
      grossValue:       Number(line.grossValue),
      netValue:         Number(line.netValue),
      price:            Number(line.price),
      totalValue:       Number(line.netValue),
      invoicedQuantity: Number(line.invoicedQuantity),
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