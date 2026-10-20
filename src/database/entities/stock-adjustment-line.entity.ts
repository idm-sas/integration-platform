import {
  Entity, PrimaryGeneratedColumn, Column, Index, Unique,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { StockAdjustment } from './stock-adjustment.entity';
import { Product } from './product.entity';
import { Locator } from './locator.entity';

@Entity('stock_adjustment_lines')
@Index('IDX_stock_adjustment_lines_header', ['stockAdjustmentId'])
@Index('IDX_stock_adjustment_lines_product', ['productId'])
export class StockAdjustmentLine {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_stock_adjustment_lines' })
  id!: string;

  @Column({ type: 'uuid' })
  stockAdjustmentId!: string;

  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'uuid' })
  locatorErpId!: string;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  stockQuantityInStdUnit!: number;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  stockQuantityInUnitOld!: number;

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  stockQuantityInUnitNew!: number;

  @ManyToOne(() => StockAdjustment, (header) => header.lines, {
    nullable: false, onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'stockAdjustmentId', referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_stock_adjustment_lines_header',
  })
  stockAdjustment?: StockAdjustment;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'productId', referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_stock_adjustment_lines_product',
  })
  product?: Product;

  @ManyToOne(() => Locator, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'locatorErpId', referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_stock_adjustment_lines_locator',
  })
  locator?: Locator;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()' })
  updatedAt!: Date;
}
