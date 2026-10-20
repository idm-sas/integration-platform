import {
  Entity, PrimaryGeneratedColumn, Column, Index, Unique,
  ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { StockAdjustmentLine } from './stock-adjustment-line.entity';
import { NumericTransformer } from '../utils/numeric.transformer';

@Entity('stock_adjustments')
@Index('IDX_stock_adjustments_organization', ['organization'])
@Index('IDX_stock_adjustments_sellerErpId', ['sellerErpId'])
@Index('IDX_stock_adjustments_movementDate', ['movementDate'])
@Index('UQ_stock_adjustments_documentNo', ['documentNo'], { unique: true })
@Index('IDX_stock_adjustments_warehouseErpId', ['warehouseErpId'])
@Index('IDX_stock_adjustments_warehouse_date', ['warehouseErpId', 'movementDate'])
export class StockAdjustment {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_stock_adjustments' })
  id!: string;

  @Column({ type: 'varchar', length: 60 })
  organization!: string;

  @Column({ type: 'varchar', length: 60 })
  sellerErpId!: string;

  @Column({ type: 'date' })
  movementDate!: string;

  @Column({ type: 'varchar', length: 60 })
  documentNo!: string;

  @Column({ type: 'uuid' })
  warehouseErpId!: string;

  @Column('numeric', {
      precision: 18,
      scale: 2,
      default: 0,
      transformer: new NumericTransformer(2),
    })
  totalValue!: number;

  @Column({ type: 'varchar', length: 10 })
  status!: string;

  @Column({ type: 'text', nullable: true })
  remark!: string | null;

  @Column({ type: 'integer' })
  c_doctype_id!: number;

  @ManyToOne(() => Warehouse, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'warehouseErpId', referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_stock_adjustments_warehouse',
  })
  warehouse?: Warehouse;

  @OneToMany(() => StockAdjustmentLine, (line) => line.stockAdjustment)
  lines?: StockAdjustmentLine[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()' })
  updatedAt!: Date;
}
