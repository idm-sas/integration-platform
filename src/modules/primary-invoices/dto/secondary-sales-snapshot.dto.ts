import { ApiProperty } from '@nestjs/swagger';

// ─── Line ─────────────────────────────────────────────────────────────────────

export class SecondarySalesLineDto {
  @ApiProperty({ example: 'AA0103025' })
  productErpId!: string;

  @ApiProperty({ example: 'TL-5 ESS 21W/865' })
  productName!: string;

  @ApiProperty({ example: 'AA0103025' })
  sapProductCode!: string;

  @ApiProperty({ example: 675405.41 })
  grossValue!: number;

  @ApiProperty({ example: 659736.00 })
  netValue!: number;

  @ApiProperty({ example: 36652.00 })
  price!: number;

  @ApiProperty({ example: 659736.00 })
  totalValue!: number;

  @ApiProperty({ example: '12%', nullable: true })
  discount1Code!: string | null;

  @ApiProperty({ example: 12.00 })
  discount1Percent!: number;

  @ApiProperty({ example: 0 })
  freeQty!: number;

  @ApiProperty({ example: 18 })
  invoicedQuantity!: number;

  @ApiProperty({ example: 'PCS' })
  uom!: string;

  constructor(partial: Partial<SecondarySalesLineDto>) {
    Object.assign(this, partial);
  }
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

export class SecondarySalesInvoiceDto {
  @ApiProperty({ example: 'TR1' })
  sellerErpId!: string;

  @ApiProperty({ example: 'Sunter' })
  sellerName!: string;

  @ApiProperty({ example: 'ATR1-OPN-2602-1199', nullable: true })
  orderNo!: string | null;

  @ApiProperty({ example: '2026-02-13' })
  invoiceDate!: string;

  @ApiProperty({ example: 'ATR1-FKN-2602-1124' })
  invoiceNo!: string;

  @ApiProperty({ example: 'Sunter F1-2', nullable: true })
  warehouseErpId!: string | null;

  @ApiProperty({ example: 675405.41 })
  totalGrossValue!: number;

  @ApiProperty({ example: 'CO' })
  status!: string;

  @ApiProperty({ example: 81047.75 })
  totalDiscount!: number;

  @ApiProperty({ example: 659736.00 })
  totalNetValue!: number;

  @ApiProperty({ example: 11 })
  taxPercent!: number;

  @ApiProperty({ example: 65378.34 })
  taxValue!: number;

  @ApiProperty({ example: 659736.00 })
  totalValue!: number;

  @ApiProperty({ example: 18 })
  totalQuantity!: number;

  @ApiProperty({ example: null, nullable: true })
  remark!: string | null;

  @ApiProperty({ example: 'lutfi161' })
  esmErpId!: string;

  @ApiProperty({ example: 'Lutfi-161204' })
  esmName!: string;

  @ApiProperty({ example: '00022' })
  retailerErpId!: string;

  @ApiProperty({ example: 'NASA ELECTRIC' })
  retailerName!: string;

  @ApiProperty({ type: () => [SecondarySalesLineDto] })
  lines!: SecondarySalesLineDto[];

  constructor(partial: Partial<SecondarySalesInvoiceDto>) {
    Object.assign(this, partial);
  }
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export class SecondarySalesMetaDto {
  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;

  @ApiProperty({ example: '2026-09-21T00:00:00.000Z' })
  generatedAt!: string;
}

// ─── Response ─────────────────────────────────────────────────────────────────

export class SecondarySalesSnapshotResponseDto {
  @ApiProperty({ example: 'Data berhasil diambil' })
  message!: string;

  @ApiProperty({ type: () => [SecondarySalesInvoiceDto] })
  data!: SecondarySalesInvoiceDto[];

  @ApiProperty({ type: SecondarySalesMetaDto })
  meta!: SecondarySalesMetaDto;
}