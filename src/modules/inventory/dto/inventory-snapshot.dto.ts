import { ApiProperty } from '@nestjs/swagger';

export class InventorySnapshotItemDto {
  @ApiProperty()
  productErpId: string;

  @ApiProperty({
    nullable: true,
  })
  sapProductCode: string | null;

  @ApiProperty()
  stockQuantityInStdUnit: number;

  @ApiProperty()
  stockQuantityInUnit: number;

  @ApiProperty({
    nullable: true,
  })
  batchNo: string | null;

  constructor(partial: Partial<InventorySnapshotItemDto>) {
    Object.assign(this, partial);
  }
}

export class InventorySnapshotWarehouseDto {
  @ApiProperty()
  distributorErpId: string;

  @ApiProperty()
  warehouseErpId: string;

  @ApiProperty()
  warehouseName: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  lastUpdatedAt: string;

  @ApiProperty({
    type: () => [InventorySnapshotItemDto],
  })
  items: InventorySnapshotItemDto[];

  constructor(partial: Partial<InventorySnapshotWarehouseDto>) {
    Object.assign(this, partial);
  }
}

export class InventorySnapshotMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  generatedAt: string;
}

export class InventorySnapshotResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({
    type: () => [InventorySnapshotWarehouseDto],
  })
  data: InventorySnapshotWarehouseDto[];

  @ApiProperty({
    type: InventorySnapshotMetaDto,
  })
  meta: InventorySnapshotMetaDto;
}