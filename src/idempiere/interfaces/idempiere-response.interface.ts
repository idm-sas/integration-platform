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
