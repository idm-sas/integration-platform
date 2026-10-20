export class StockTransfersLineDto {
  ProductErpId!: string;
  ProductName!: string;
  sapProductCode!: string;
  ActualReceiveStockQty!: number;
  constructor(data: Partial<StockTransfersLineDto>) {
    Object.assign(this, data);
  }
}

export class StockTransfersDto {
  ERPTransferDocId!: string;
  DistributorErpId!: string;
  FromWarehouseErpId!: string;
  ToWarehouseErpId!: string;
  Time!: string;
  Items!: StockTransfersLineDto[];
  constructor(data: Partial<StockTransfersDto>) {
    Object.assign(this, data);
  }
}

export class StockTransfersSnapshotResponseDto {
  message!: string;
  data!: StockTransfersDto[];

  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    generatedAt: string;
  };
}