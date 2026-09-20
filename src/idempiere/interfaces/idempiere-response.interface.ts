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
  ExternalReference: string;
  IsActive: boolean;
  IsShipTo: boolean;
  IsBillTo: boolean;
  IsMainArcode: boolean;
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
  Arcode: string;
  IsSyncToIntegration: boolean;
}
export interface IdempiereRetailerRulesRecord extends IdempiereRecord {
  C_BPartner_ID: { id: number; identifier: string };
  AD_OrgTrx_ID: { id: number; identifier: string };
  SO_CreditLimit: number;
  SalesRep_ID: { C_BPartner_ID: { id: number; identifier: string } };
  C_PaymentTerm_ID: { id: number; identifier: string };
  M_Product_Category_ID: { id: number; identifier: string };
  IsAllowNegotiation: { id: number; identifier: string };
  IsActive: string;
  Created: string;
  Updated: string;
}
export interface IdempiereWarehouseRecord extends IdempiereRecord {
  Value: string;
  Name: string;
  AD_Org_ID: { id: number; identifier: string };
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
  M_Product_ID: {
    id: number;
    identifier: string;
  };
  M_Locator_ID: {
    id: number;
    identifier: string;
    Value?: string;
    M_Warehouse_ID?: {
      id: number;
      identifier: string;
    };
    M_LocatorType_ID?: { id: number; identifier: string };
  };
  QtyOnHand: number;
  QtyOnHandInUOM?: number;
  QtyReserved?: number;
  QtyOrdered?: number;
  Created?: string;
  Updated?: string;
  DateMaterialPolicy?: string;
  M_AttributeSetInstance_ID?: {
    id: number;
  };
}

export interface IdempiereSecondarySalesRecord extends IdempiereRecord {
  // organization
  AD_Org_ID: {
    id: number;
    identifier: string;
  };
  AD_OrgTrx_ID: {
    id: number;
    identifier: string;
  };
  DocumentNo: string;
  DateInvoiced: string;
  DocStatus: {
    id: number;
    identifier: string;
  };
  C_Order_ID?: {
    id: number;
    DocumentNo: string;
    M_Warehouse_ID?: {
      id: number;
    } | null;
  } | null;

  // Lookup retailerErpId ke master retailer lokal
  C_BPartner_ID: {
    id: number;
    Value: string;
  };

  // Lookup esmId ke master salesman lokal
  SalesRep_ID?: {
    id: number; // AD_User_ID
    C_BPartner_ID?: {
      id: number; // Business partner salesman
    } | null;
  } | null;

  // Sumber nilai invoice
  TotalLines: number;
  GrandTotal: number;
  IsTaxIncluded: boolean;

  // remark, issotrx, c_doctype_id
  Description?: string | null;
  IsSOTrx: boolean;
  C_DocType_ID: {
    id: number;
  };

  Created: string;
  Updated: string;

  // Hasil expand, sesuai nama pada JSON
  C_InvoiceLine: IdempiereSecondarySalesLineRecord[];
}

export interface IdempiereSecondarySalesLineRecord
  extends IdempiereRecord {
  // Baris keterangan tidak mempunyai produk
  IsDescription: boolean;

  // Lookup productId ke master produk lokal
  M_Product_ID?: {
    id: number;
  } | null;

  // Sumber grossValue, netValue, price, invoicedQuantity
  PriceList: number;
  PriceActual: number;
  LineNetAmt: number;
  QtyInvoiced: number;

  // uom
  C_UOM_ID: {
    id: number;
    identifier: string;
  };

  // Sumber pajak invoice
  TaxAmt: number;
  C_Tax_ID?: {
    id: number;
  } | null;

  // Referensi discount1Code
  SAS_DiscountList_ID?: {
    id: number;
    identifier: string;
  } | null;

  // Sumber discount1Percent dan fallback referensi diskon
  C_OrderLine_ID?: {
    id: number;
    Discount: number;
    SAS_DiscountList_ID?: {
      id: number;
      identifier: string;
    } | null;
  } | null;

  // description
  Description?: string | null;

  Created: string;
  Updated: string;
}