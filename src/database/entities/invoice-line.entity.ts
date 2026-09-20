import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { InvoiceHeader } from './invoice-header.entity';
import { Product } from './product.entity';
import { NumericTransformer } from '../utils/numeric.transformer';

@Entity('invoice_lines')
@Index('IDX_invoice_lines_invoiceHeaderId', ['invoiceHeaderId'])
@Index('IDX_invoice_lines_productId', ['productId'])
@Index(
  'IDX_invoice_lines_header_product',
  ['invoiceHeaderId', 'productId'],
)
export class InvoiceLine {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_invoice_lines',
  })
  id!: string;

  @Column({ type: 'uuid' })
  invoiceHeaderId!: string;

  @ManyToOne(() => InvoiceHeader, (header) => header.lines, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'invoiceHeaderId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_invoice_lines_header',
  })
  invoiceHeader?: InvoiceHeader;

  @Column({ type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'productId',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_invoice_lines_product',
  })
  product?: Product;

   @Column('numeric', {
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(2),
  })
  grossValue!: number;

  @Column('numeric', {
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(2),
  })
  netValue!: number;

  @Column('numeric', {
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new NumericTransformer(2),
  })
  price!: number;

  @Column('numeric', {
    precision: 7,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(4),
  })
  discount1Percent!: number;

  @Column('numeric', {
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(4),
  })
  freeQty!: number;

  @Column('numeric', {
    precision: 18,
    scale: 4,
    default: 0,
    transformer: new NumericTransformer(4),
  })
  invoicedQuantity!: number;

  @Column({ type: 'varchar', length: 60, nullable: true })
  discount1Code!: string | null;

  @Column({ type: 'varchar', length: 20 })
  uom!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

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