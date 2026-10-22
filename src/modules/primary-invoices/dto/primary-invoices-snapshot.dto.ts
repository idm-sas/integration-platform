import { ApiProperty } from '@nestjs/swagger';

// ─── Line ─────────────────────────────────────────────────────────────────────
export class PrimaryInvoiceLineDto {
  @ApiProperty({ example: 'ATR1-PPV-2610-0001', nullable: true })
  erpSoNo!: string | null;
  @ApiProperty({ example: 'AA0103025' })
  productErpId!: string;
  @ApiProperty({ example: 'TL-5 ESS 21W/865' })
  productName!: string;
  @ApiProperty()
  sapProductCode!: string;
  @ApiProperty({ example: 675405.41 })
  grossValue!: number;
  @ApiProperty({ example: 659736.00 })
  netValue!: number;
  @ApiProperty({ example: 36652.00 })
  price!: number;
  @ApiProperty({ example: 659736.00 })
  totalValue!: number;
  @ApiProperty({ example: 18 })
  invoicedQuantity!: number;
  constructor(partial: Partial<PrimaryInvoiceLineDto>) {
    Object.assign(this, partial);
  }
}

// ─── Invoice ──────────────────────────────────────────────────────────────────
export class PrimaryInvoicesDto {
  @ApiProperty({ example: 'TR1' })
  sellerErpId!: string;
  @ApiProperty({ example: 'Sunter' })
  sellerName!: string;
  @ApiProperty({ example: '2026-10-01' })
  invoiceDate!: string;
  @ApiProperty({ example: 'ATR1-IVA-2610-0001' })
  erpInvoiceNo!: string;
  @ApiProperty({ example: 675405.41 })
  totalGrossValue!: number;
  @ApiProperty({ example: 81047.75 })
  totalDiscount!: number;
  @ApiProperty({ example: 659736.00 })
  totalNetValue!: number;
  @ApiProperty({ example: 659736.00 })
  totalValue!: number;
  @ApiProperty({ example: 18 })
  totalQuantity!: number;
  @ApiProperty({ example: 65378.34 })
  taxValue!: number;
  @ApiProperty({ example: 'CO' })
  status!: string;
  @ApiProperty({ type: () => [PrimaryInvoiceLineDto] })
  lines!: PrimaryInvoiceLineDto[];

  constructor(partial: Partial<PrimaryInvoicesDto>) {
    Object.assign(this, partial);
  }
}

// ─── Meta ─────────────────────────────────────────────────────────────────────
export class PrimaryInvoicesMetaDto {
  @ApiProperty({ example: 100 })
  total!: number;
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  limit!: number;
  @ApiProperty({ example: 5 })
  totalPages!: number;
  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  generatedAt!: string;
}

// ─── Response ─────────────────────────────────────────────────────────────────

export class PrimaryInvoicesSnapshotResponseDto {
  @ApiProperty({ example: 'Data berhasil diambil' })
  message!: string;
  @ApiProperty({ type: () => [PrimaryInvoicesDto] })
  data!: PrimaryInvoicesDto[];
  @ApiProperty({ type: PrimaryInvoicesMetaDto })
  meta!: PrimaryInvoicesMetaDto;
}