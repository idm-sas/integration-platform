export class StockAdjustmentsLineDto {
  productErpId!: string;
  sapProductCode!: string;
  stockQuantityInUnitOld!: number;
  stockQuantityInUnitNew!: number;
  time!: string;

  constructor(data: Partial<StockAdjustmentsLineDto>) {
    Object.assign(this, data);
  }
}

export class StockAdjustmentsDto {
  distributorErpId!: string;
  warehouseErpId!: string;
  product!: StockAdjustmentsLineDto[];

  constructor(data: Partial<StockAdjustmentsDto>) {
    Object.assign(this, data);
  }
}

export class StockAdjustmentsSnapshotResponseDto {
  message!: string;
  data!: StockAdjustmentsDto[];

  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    generatedAt: string;
  };
}