import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  OneToMany,
  Unique
} from 'typeorm';
import { RetailerRules } from './retailer-rules.entity';

@Entity('retailers')
@Unique('UQ_retailers_bp_location', [
  'idempiereId',
  'locationIdempiereId',
])

@Entity('retailers')
export class Retailer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** C_BPartner.C_BPartner_ID dari iDempiere */
  @Column({ type: 'integer', unique: true })
  idempiereId: number;

  /** C_BPartner.Value */
  @Column({ unique: true })
  value: string;

  /** C_BPartner.Name */
  @Column()
  name: string;

  @Column({ nullable: true })
  name2: string;

  /** C_BPartner_Group.Value */
  @Column({ nullable: true })
  bpGroup: string;

  /** C_BPartner_Location.Name */  
  @Column()
  location: string;

  /** C_Location.Address */
  @Column({ nullable: true })
  address: string;

  /** C_Location.Address2 */
  @Column({ nullable: true })
  marketname: string;

  /** C_Location.City */
  @Column({ nullable: true })
  city: string;

  /** C_Location.Address4 */
  @Column({ nullable: true })
  subcity: string;

  /** C_Location.RegionName */
  @Column({ nullable: true })
  region: string;

  /** C_Country.Name */
  @Column({ nullable: true })
  country: string;

  /** C_Country.postal */
  @Column({ nullable: true })
  postal: string;

  @Column({ nullable: true })
  arcode: string;

  @Column({ type: 'boolean', default: false })
  isVendor: boolean;

  @Column({ default: true })
  isCustomer: boolean;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => RetailerRules, (rr) => rr.retailer)
  rules: RetailerRules[];

  @Column({ nullable: true })
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: false })
  isSyncToIntegration: boolean;

  @Column({ type: 'integer', nullable: true })
  locationIdempiereId: number | null;

  @Column({ type: 'boolean', default: false })
  isLocationActive: boolean;

  @Column({ default: false })
  isShipTo: boolean;

  @Column({ default: false })
  isBillTo: boolean;

  @Column({ default: false })
  isMainArcode: boolean;

  @Column({ default: false })
  isBPReplacement: boolean;
}