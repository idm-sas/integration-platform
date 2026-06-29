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
  C_UOM_ID?: { id: number; identifier: string };
  M_Product_Category_ID?: { id: number; identifier: string };
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
  M_Product_ID: { id: number; identifier: string };
  M_PriceList_Version_ID: { id: number; identifier: string };
  PriceList: number;
  PriceStd: number;
  PriceLimit: number;
  IsActive: string;
  Updated: string;
}
