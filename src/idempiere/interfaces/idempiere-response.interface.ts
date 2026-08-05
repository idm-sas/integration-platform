export interface IdempiereListResponse<T = any> {
  'page-count': number;
  'records-size': number;
  'skip-records': number;
  'row-count': number;
  'array-count': number;
  records: T[];
}

export interface IdempiereRecord {
  id: number;
  uid: string;
  'model-name': string;
  [key: string]: any;
}

export interface IdempiereProductRecord extends IdempiereRecord {
  Value: string;
  Name: string;
  Description?: string;
  IsActive: string;
  SKU: string;
  C_UOM_ID?: { id: number; Name: string };
  M_Product_Category_ID?: { id: number; Name: string };
  Group1?: { id: string; identifier: string };
  Group2?: { id: string; identifier: string };
  Updated: string;
  Created: string;
}

export interface IdempiereCategoryRecord extends IdempiereRecord {
  Value: string;
  Name: string;
  Description?: string;
  IsActive: string;
  Updated: string;
  Created: string;
}

export interface IdempierePriceRecord extends IdempiereRecord {
  M_Product_ID: { id: number; Name: string };
  M_PriceList_Version_ID: { id: number; Name: string };
  PriceList: number;
  PriceStd: number;
  PriceLimit: number;
  IsActive: string;
  Updated: string;
}
export interface IdempiereAdUser {
  id: number;
  uid: string;
  Name: string;
  Description?: string;
  EMail?: string;
  Value?: string;
  Birthday?: string;
  Phone?: string;
  C_Job_ID?: { id: number; identifier: string };
  ContactDescription?: string;
  IsActive: boolean;
}
export interface IdempiereSalesmanRecord extends IdempiereRecord {
  Value: string;
  Name: string;
  Name2?: string;
  IsSalesRep: string;
  IsActive: boolean;
  C_BP_Group_ID?: { id: number; identifier: string };
  AD_User?: IdempiereAdUser[];
  Updated: string;
  Created: string;
}
export interface IdempiereCBPLocationRecord {
  id: number;
  uid: string;
  Name: string;
  C_Location_ID?: { 
    id: number; 
    identifier: string 
    Address2: string;
    Address3: string;
    Address4: string;
    C_Country_ID?: { id: number; identifier: string };
    City: string;
    Postal: string;
  };
  Arcode: string;
  IsActive: boolean;
}
export interface IdempiereRetailerRecord extends IdempiereRecord {
  Value: string;
  Name: string;
  Name2?: string;
  IsCustomer?: boolean;
  IsActive: boolean;
  C_BP_Group_ID?: { id: number; identifier: string };
  C_BPartner_Location?: IdempiereCBPLocationRecord[];
  Updated: string;
  Created: string;
}
export interface IdempiereWarehouseRecord extends IdempiereRecord {
  Value: string;
  Name: string;
  Description?: string;
  IsActive: boolean | string;
  Updated: string;
  Created: string;
}

export interface IdempiereLocatorRecord extends IdempiereRecord {
  Value: string;
  X?: string;   // Aisle
  Y?: string;   // Bin
  Z?: string;   // Level
  priorityNo?: number;
  IsDefault: boolean | string;
  IsActive: boolean | string;
  M_Warehouse_ID: { id: number; identifier: string };
  Updated: string;
  Created: string;
}
export interface IdempiereStorageOnHandRecord extends IdempiereRecord {
  M_Product_ID: { id: number; identifier: string };
  M_Locator_ID?: { id: number; identifier: string };
  QtyOnHand: number;
  // QtyReserved: number;
  // QtyOrdered: number;
  // M_AttributeSetInstance_ID?: {
  //   id: number;
  //   identifier: string;
  //   Lot?: string;
  //   Description?: string;
  // };
  IsActive: boolean | string;
}


export interface SecondarySalesInvoiceRecord {

  orderNo: string;

  invoiceDate: string;

  invoiceNo: string;

  totalGrossValue: number;

  status: string;

  totalDiscount: number;

  totalNetValue: number;

  taxPercent: number;

  taxValue: number;

  totalValue: number;

  totalQuantity: number;

  remark: string | null;


  esmErpId: string;

  esmName: string;


  retailerErpId: string;

  retailerName: string;


  lines: SecondarySalesLineRecord[];

}



export interface SecondarySalesLineRecord {

  productErpId: string;

  productName: string;

  grossValue: number;

  netValue: number;

  price: number;

  totalValue: number;

  freeQty: number;

  invoicedQuantity: number;

  uom: string;

}