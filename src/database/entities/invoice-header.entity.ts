import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';

import { Warehouse } from './warehouse.entity';
import { Retailer } from './retailers.entity';
import { Salesman } from './salesman.entity';
import { InvoiceLine } from './invoice-line.entity';
import { NumericTransformer } from '../utils/numeric.transformer';

@Entity('invoice_headers')
@Index('IDX_invoice_headers_organization', ['organization'])
@Index('IDX_invoice_headers_sellerErpId', ['sellerErpId'])
@Index('IDX_invoice_headers_invoiceDate', ['invoiceDate'])
@Index('UQ_invoice_headers_invoiceNo', ['invoiceNo'], { unique: true })
@Index('IDX_invoice_headers_warehouseErpId', ['warehouseErpId'])
@Index('IDX_invoice_headers_retailerErpId', ['retailerErpId'])
@Index('IDX_invoice_headers_esmId', ['esmId'])
@Check(
  'CHK_invoice_headers_issotrx',
  `"issotrx" IN ('Y', 'N')`,
)
export class InvoiceHeader {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_invoice_headers',
  })
  id!: string;

  @Column({ type: 'varchar', length: 60 })
  organization!: string;

  @Column({ type: 'varchar', length: 60 })
  sellerErpId!: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  orderNo!: string | null;

  @Column({ type: 'date' })
  invoiceDate!: string;

  @Column({ type: 'varchar', length: 60, unique: true })
  invoiceNo!: string;

  @Column({ type: 'uuid' })
  warehouseErpId!: string;

  @ManyToOne(() => Warehouse, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'warehouseErpId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_invoice_warehouses',
  })
  warehouse?: Warehouse;

  // ── Nilai uang pakai scale 2 (konsisten dengan round2() di service) ──────
  @Column('numeric', {
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(2),
  })
  totalGrossValue!: number;

  @Column({ type: 'varchar', length: 10 })
  status!: string;

  @Column('numeric', {
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(2),
  })
  totalDiscount!: number;

  // Cash discount dari C_Charge di C_OrderLine
  // Saat ini diisi 0 karena expand REST belum include C_Charge_ID
  @Column('numeric', {
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(2),
  })
  totalCashDiscountValue!: number;

  @Column('numeric', {
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(2),
  })
  totalNetValue!: number;
  
 @Column('numeric', {
    precision: 5,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(2),
  })
  taxPercent!: number;

  @Column('numeric', {
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(2),
  })
  taxValue!: number;

  @Column('numeric', {
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(2),
  })
  totalValue!: number;

  @Column({ type: 'text', nullable: true })
  remark!: string | null;

  @Column({ type: 'uuid' })
  retailerErpId!: string;

  @ManyToOne(() => Retailer, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'retailerErpId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_invoice_retailer',
  })
  retailer?: Retailer;

  @Column({ type: 'uuid' })
  esmId!: string;

  @ManyToOne(() => Salesman, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'esmId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_invoice_salesman',
  })
  salesman?: Salesman;

  @Column({ type: 'char', length: 1, default: 'N' })
  issotrx!: 'Y' | 'N';

  @Column({ name: 'c_doctype_id', type: 'integer' })
  c_doctype_id!: number;

  @OneToMany(() => InvoiceLine, (line) => line.invoiceHeader)
  lines?: InvoiceLine[];

  @CreateDateColumn({
    name: 'createdAt',
    type: 'timestamp',
    default: () => 'now()',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updatedAt',
    type: 'timestamp',
    default: () => 'now()',
  })
  updatedAt!: Date;
}