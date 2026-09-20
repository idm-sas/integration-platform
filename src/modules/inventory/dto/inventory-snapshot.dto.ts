import { ApiProperty } from '@nestjs/swagger';

export class InventorySnapshotItemDto {
  @ApiProperty()
  productErpId: string;

  @ApiProperty({ type: String, nullable: true })
  sapProductCode: string | null;

  @ApiProperty({ type: Number })
  stockQuantityInStdUnit: number;

  @ApiProperty({ type: Number })
  stockQuantityInUnit: number;

  @ApiProperty({ type: String, nullable: true })
  batchNo: string | null;

  // Service menggunakan Date; saat menjadi JSON akan berupa ISO string.
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
  })
  dateInventory: string | null;
}

export class InventorySnapshotWarehouseDto {
  @ApiProperty({ type: String, nullable: true })
  distributorErpId: string | null;

  @ApiProperty()
  warehouseErpId: string;

  @ApiProperty()
  warehouseName: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  lastUpdatedAt: string;

  @ApiProperty({ type: [InventorySnapshotItemDto] })
  items: InventorySnapshotItemDto[];
}

export class InventorySnapshotMetaDto {
  @ApiProperty({ description: 'Total warehouse seluruh halaman.' })
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty({
    description: 'Total baris stok seluruh halaman.',
  })
  totalItems: number;
}

export class InventorySnapshotResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: [InventorySnapshotWarehouseDto] })
  data: InventorySnapshotWarehouseDto[];

  @ApiProperty({ type: InventorySnapshotMetaDto })
  meta: InventorySnapshotMetaDto;
}